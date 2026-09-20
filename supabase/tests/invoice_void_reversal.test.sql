-- Disposable database only. Fixtures and assertions roll back together.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users (id,email) values ('94000000-0000-0000-0000-000000000001','void@example.invalid');
insert into businesses (id,name) overriding system value values (-94001,'Void Co');
insert into business_members (business_id,user_id,role,active) values (-94001,'94000000-0000-0000-0000-000000000001','owner',true);
insert into customers (id,business_id,customer_type,first_name) overriding system value values (-94001,-94001,'individual','Fixture');
insert into jobs (id,business_id,customer_id,status,amount_quoted) overriding system value values
  (-94001,-94001,-94001,'completed',275),
  (-94002,-94001,-94001,'completed',275),
  (-94003,-94001,-94001,'completed',275);
set local role authenticated;
set local request.jwt.claim.sub = '94000000-0000-0000-0000-000000000001';

-- Paid: the capture posts revenue and settles the job.
select create_invoice_record(-94001,-94001,-94001,275,current_date,null,null,'unpaid',null,null) as invoice_a \gset
select set_invoice_status(:invoice_a,'paid',current_date);
select is((select count(*) from payments where invoice_id=:invoice_a and voided_at is null),1::bigint,'capture created a payment');
select is((select status from journal_entries where source_type='payment'
  and source_id=(select id from payments where invoice_id=:invoice_a)),'posted','revenue is posted');
select is((select status from jobs where id=-94001),'paid','job settled');

-- Voided: the capture is reversed, its revenue with it, and the job reopens.
select set_invoice_status(:invoice_a,'void',null);
select isnt((select voided_at from payments where invoice_id=:invoice_a),null,'captured payment is voided');
select is((select status from journal_entries where source_type='payment'
  and source_id=(select id from payments where invoice_id=:invoice_a)),'void','revenue is reversed');
select is((select status from jobs where id=-94001),'completed','job returns to completed');
select is((select amount_paid from jobs where id=-94001),0::numeric,'job no longer shows as paid');

-- Back to unpaid rather than void: the job is still invoiced, not completed.
select create_invoice_record(-94001,-94001,-94002,275,current_date,null,null,'unpaid',null,null) as invoice_b \gset
select set_invoice_status(:invoice_b,'paid',current_date);
select set_invoice_status(:invoice_b,'unpaid',null);
select is((select status from jobs where id=-94002),'invoiced','unpaid leaves the job invoiced');

-- A payment recorded in its own right survives: that money really did arrive.
select create_invoice_record(-94001,-94001,-94003,275,current_date,null,null,'unpaid',null,null) as invoice_c \gset
select record_payment(-94001,:invoice_c,null,current_date,275,'Check',null,null,null) as manual_payment \gset
select set_invoice_status(:invoice_c,'void',null);
select is((select voided_at from payments where id=:manual_payment),null,'manual payment is untouched');
select is((select status from journal_entries where source_type='payment' and source_id=:manual_payment),'posted','its revenue stands');
select is((select status from jobs where id=-94003),'paid','job stays paid on real money');

select * from finish();
rollback;
