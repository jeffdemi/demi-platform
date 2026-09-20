-- Disposable database only. Fixtures and assertions roll back together.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users (id,email) values ('92000000-0000-0000-0000-000000000001','num1@example.invalid');
insert into businesses (id,name) overriding system value values (-92001,'Numbering Co'),(-92002,'Legacy Numbering Co');
insert into business_members (business_id,user_id,role,active) values (-92001,'92000000-0000-0000-0000-000000000001','owner',true);
insert into business_members (business_id,user_id,role,active) values (-92002,'92000000-0000-0000-0000-000000000001','owner',true);
insert into customers (id,business_id,first_name) overriding system value values (-92001,-92001,'Fixture'),(-92002,-92001,'Other'),(-92003,-92002,'Legacy');
-- Ascending id is this business's creation order, so these are its 1st, 2nd and 3rd jobs.
insert into jobs (id,business_id,customer_id,status) overriding system value values
  (-92003,-92001,-92001,'completed'),(-92002,-92001,-92001,'completed'),(-92001,-92001,-92001,'completed');
insert into jobs (id,business_id,customer_id,status) overriding system value values (-92000,-92001,-92002,'completed');
insert into jobs (id,business_id,customer_id,status) overriding system value values (-92005,-92002,-92003,'completed');
-- A number issued before the suffix existed, to prove the sequence still reads it.
insert into invoices (id,business_id,customer_id,invoice_number,amount,invoice_date) overriding system value
  values (-92001,-92002,-92003,'INV-2026-0007',100,'2026-03-01');
set local role authenticated;
set local request.jwt.claim.sub = '92000000-0000-0000-0000-000000000001';

-- The third job this business created, so the suffix is 03.
select lives_ok($test$select create_invoice_record(-92001,-92001,-92001,100,'2026-03-04'::date,null,null,'unpaid',null,null)$test$,'invoice created');
select is((select invoice_number from invoices where business_id=-92001 and job_id=-92001),'INV-2026-0001-03','job ordinal becomes the suffix');

-- The sequence must advance on the sequence group, not the job suffix.
select lives_ok($test$select create_invoice_record(-92001,-92001,-92003,100,'2026-03-05'::date,null,null,'unpaid',null,null)$test$,'second invoice created');
select is((select invoice_number from invoices where business_id=-92001 and job_id=-92003),'INV-2026-0002-01','sequence ignores the suffix digits');

-- Suffixes repeat every hundred jobs, so uniqueness rests on the sequence group.
select is((select count(distinct invoice_number) from invoices where business_id=-92001),2::bigint,'numbers stay unique');

-- Pre-suffix numbers are still read by the sequence scan.
select lives_ok($test$select create_invoice_record(-92002,-92003,-92005,100,'2026-03-06'::date,null,null,'unpaid',null,null)$test$,'invoice created after legacy number');
select is((select invoice_number from invoices where business_id=-92002 and job_id=-92005),'INV-2026-0008-01','sequence continues from a pre-suffix number');

-- A job is now required, and must still belong to the invoiced customer.
select throws_ok($test$select create_invoice_record(-92001,-92001,null,100,'2026-03-07'::date,null,null,'unpaid',null,null)$test$,'23502',null,'invoice without a job rejected');
select throws_ok($test$select create_invoice_record(-92001,-92001,-92000,100,'2026-03-07'::date,null,null,'unpaid',null,null)$test$,'23503',null,'job belonging to another customer rejected');

select * from finish();
rollback;
