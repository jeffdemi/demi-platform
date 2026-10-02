-- Disposable database only. Fixtures and assertions roll back together.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users (id,email) values ('91000000-0000-0000-0000-000000000001','rls1@example.invalid');
insert into auth.users (id,email) values ('91000000-0000-0000-0000-000000000002','rls2@example.invalid');
insert into auth.users (id,email) values ('91000000-0000-0000-0000-000000000003','rls3@example.invalid');
insert into auth.users (id,email) values ('91000000-0000-0000-0000-000000000004','rls4@example.invalid');
insert into businesses (id,name) overriding system value values (-91001,'RLS Alpha'),(-91002,'RLS Beta');
insert into business_members (business_id,user_id,role,active) values (-91001,'91000000-0000-0000-0000-000000000001','owner',true);
insert into business_members (business_id,user_id,role,active) values (-91002,'91000000-0000-0000-0000-000000000002','owner',true);
insert into business_members (business_id,user_id,role,active) values (-91001,'91000000-0000-0000-0000-000000000003','employee',true);
insert into business_members (business_id,user_id,role,active) values (-91001,'91000000-0000-0000-0000-000000000004','intern',true);
insert into customers (id,business_id,first_name) overriding system value values (-91001,-91001,'Fixture');
insert into jobs (id,business_id,customer_id,status) overriding system value values (-91001,-91001,-91001,'completed'),(-91003,-91001,-91001,'completed');
insert into customers (id,business_id,first_name) overriding system value values (-91002,-91002,'Fixture');
insert into jobs (id,business_id,customer_id,status) overriding system value values (-91002,-91002,-91002,'completed');

set local role authenticated;
set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000001';

-- mileage_settings: owner-only, per-business
select lives_ok($test$insert into mileage_settings (business_id, home_base_address) values (-91001, '1 Home Base Rd')$test$, 'owner can set home base');
select throws_ok($test$insert into mileage_settings (business_id, home_base_address) values (-91002, 'Attempt')$test$, '42501', null, 'mileage_settings: foreign insert denied');
select is((select count(*) from mileage_settings where business_id=-91002),0::bigint,'mileage_settings: other tenant invisible');

set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000003';
select throws_ok($test$insert into mileage_settings (business_id, home_base_address) values (-91001, 'Employee attempt')$test$, '42501', null, 'mileage_settings: employee (non-admin) denied');
set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000001';

-- mileage_trips: normal business-member CRUD, tenant-scoped
select lives_ok($test$insert into mileage_trips (id, business_id, trip_date, kind, home_base_address, destination_address, purpose, legs, total_miles) overriding system value values (-91001, -91001, current_date, 'manual', '1 Home Base Rd', 'Supply Store', 'Manual test trip', '[]'::jsonb, 10)$test$, 'owner can insert a manual trip directly');
select ok((select count(*) > 0 from mileage_trips where business_id=-91001), 'mileage_trips: owner reads own tenant');
select throws_ok($test$insert into mileage_trips (business_id, trip_date, kind, home_base_address, destination_address, purpose, legs, total_miles) values (-91002, current_date, 'manual', 'x', 'y', 'z', '[]'::jsonb, 1)$test$, '42501', null, 'mileage_trips: foreign insert denied');

-- mileage_trip_jobs: RPC-only writes, no direct grant at all
select throws_ok($test$insert into mileage_trip_jobs (business_id, trip_id, job_id) values (-91001, -91001, -91001)$test$, '42501', null, 'mileage_trip_jobs: direct insert denied, no grant');

-- create_mileage_trip RPC: atomic dedupe guard
select lives_ok(
  $test$select create_mileage_trip(-91001, current_date, 'job_suggested', '1 Home Base Rd', '1 Home Base Rd', 'Job #-91001', '[{"seq":0,"from":"1 Home Base Rd","to":"Job A","miles":5,"job_id":-91001,"job_label":"Job #-91001"},{"seq":1,"from":"Job A","to":"1 Home Base Rd","miles":5,"job_id":null,"job_label":null}]'::jsonb, 10, false, array[-91001]::bigint[], '91000000-0000-0000-0000-000000000001')$test$,
  'RPC creates a suggested trip and links its job'
);
select is((select count(*) from mileage_trip_jobs where job_id=-91001),1::bigint,'exactly one dedupe row for the linked job');

select throws_ok(
  $test$select create_mileage_trip(-91001, current_date, 'job_suggested', '1 Home Base Rd', '1 Home Base Rd', 'Job #-91001 again', '[{"seq":0,"from":"1 Home Base Rd","to":"Job A","miles":5,"job_id":-91001,"job_label":"Job #-91001"},{"seq":1,"from":"Job A","to":"1 Home Base Rd","miles":5,"job_id":null,"job_label":null}]'::jsonb, 10, false, array[-91001]::bigint[], '91000000-0000-0000-0000-000000000001')$test$,
  '23505', null, 'RPC rejects a job already linked to a trip'
);
select is((select count(*) from mileage_trips where purpose='Job #-91001 again'),0::bigint,'rejected call left no trip row behind (rolled back)');

-- a chained trip covering a second, different job succeeds independently
select lives_ok(
  $test$select create_mileage_trip(-91001, current_date, 'job_suggested', '1 Home Base Rd', '1 Home Base Rd', 'Job #-91003', '[{"seq":0,"from":"1 Home Base Rd","to":"Job C","miles":3,"job_id":-91003,"job_label":"Job #-91003"},{"seq":1,"from":"Job C","to":"1 Home Base Rd","miles":3,"job_id":null,"job_label":null}]'::jsonb, 6, false, array[-91003]::bigint[], '91000000-0000-0000-0000-000000000001')$test$,
  'RPC creates a second trip for a different job'
);

-- intern (read-only role) cannot write via the RPC
set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000004';
select throws_ok(
  $test$select create_mileage_trip(-91001, current_date, 'manual', '1 Home Base Rd', 'Store', 'Intern attempt', '[]'::jsonb, 1, false, null, '91000000-0000-0000-0000-000000000004')$test$,
  '42501', null, 'intern cannot write mileage trips via the RPC'
);

-- cross-tenant RPC call denied
set local request.jwt.claim.sub = '91000000-0000-0000-0000-000000000002';
select throws_ok(
  $test$select create_mileage_trip(-91001, current_date, 'manual', 'x', 'y', 'z', '[]'::jsonb, 1, false, null, '91000000-0000-0000-0000-000000000002')$test$,
  '42501', null, 'foreign business RPC call denied'
);

select * from finish();
rollback;
