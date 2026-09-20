-- Disposable database only. Fixtures and assertions roll back together.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users (id,email) values ('93000000-0000-0000-0000-000000000001','settle@example.invalid');
insert into businesses (id,name) overriding system value values (-93001,'Settlement Co');
insert into business_members (business_id,user_id,role,active) values (-93001,'93000000-0000-0000-0000-000000000001','owner',true);
insert into customers (id,business_id,customer_type,first_name) overriding system value values (-93001,-93001,'individual','Fixture');
insert into jobs (id,business_id,customer_id,status,amount_quoted) overriding system value values
  (-93001,-93001,-93001,'completed',300),
  (-93002,-93001,-93001,'completed',300),
  (-93003,-93001,-93001,'cancelled',300),
  (-93004,-93001,-93001,'completed',null);
set local role authenticated;
set local request.jwt.claim.sub = '93000000-0000-0000-0000-000000000001';

-- Paid in full with no invoice: the job settles instead of lingering in "Ready for invoicing".
select lives_ok($test$select record_payment(-93001,null,-93001,current_date,300,'Cash',null,null,null)$test$,'full payment recorded');
select is((select status from jobs where id=-93001),'paid','full payment settles the job');
select is((select amount_paid from jobs where id=-93001),300::numeric,'amount_paid reflects the payment');

-- Part payment is not settlement.
select lives_ok($test$select record_payment(-93001,null,-93002,current_date,100,'Cash',null,null,null)$test$,'part payment recorded');
select is((select status from jobs where id=-93002),'completed','part payment leaves the job open');
select is((select amount_paid from jobs where id=-93002),100::numeric,'part payment still recorded');

-- A cancelled job is never revived by a payment.
select lives_ok($test$select record_payment(-93001,null,-93003,current_date,300,'Cash',null,null,null)$test$,'payment on cancelled job recorded');
select is((select status from jobs where id=-93003),'cancelled','cancelled job stays cancelled');

-- With nothing quoted there is no yardstick, so any payment settles the job.
select lives_ok($test$select record_payment(-93001,null,-93004,current_date,50,'Cash',null,null,null)$test$,'payment on unquoted job recorded');
select is((select status from jobs where id=-93004),'paid','unquoted job settles on any payment');

select * from finish();
rollback;
