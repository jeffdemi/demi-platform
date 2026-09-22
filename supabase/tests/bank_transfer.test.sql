-- Disposable database only. Fixtures and assertions roll back together.
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;
select no_plan();
insert into auth.users (id,email) values ('92000000-0000-0000-0000-000000000001','rls1@example.invalid');
insert into auth.users (id,email) values ('92000000-0000-0000-0000-000000000002','rls2@example.invalid');
insert into auth.users (id,email) values ('92000000-0000-0000-0000-000000000003','rls3@example.invalid');
insert into auth.users (id,email) values ('92000000-0000-0000-0000-000000000004','rls4@example.invalid');
insert into auth.users (id,email) values ('92000000-0000-0000-0000-000000000005','rls5@example.invalid');
insert into auth.users (id,email) values ('92000000-0000-0000-0000-000000000006','rls6@example.invalid');
insert into businesses (id,name) overriding system value values (-92001,'RLS Alpha'),(-92002,'RLS Beta');
insert into business_members (business_id,user_id,role,active) values (-92001,'92000000-0000-0000-0000-000000000001','owner',true);
insert into business_members (business_id,user_id,role,active) values (-92002,'92000000-0000-0000-0000-000000000002','owner',true);
insert into business_members (business_id,user_id,role,active) values (-92001,'92000000-0000-0000-0000-000000000003','employee',true);
insert into business_members (business_id,user_id,role,active) values (-92001,'92000000-0000-0000-0000-000000000004','intern',true);
insert into business_members (business_id,user_id,role,active) values (-92001,'92000000-0000-0000-0000-000000000005','admin',true);
insert into business_members (business_id,user_id,role,active) values (-92001,'92000000-0000-0000-0000-000000000006','employee',false);
insert into bank_accounts (id,business_id,name) overriding system value values (-92001,-92001,'Fixture');
insert into bank_imports (id,business_id,account_id,file_name,source_sha256,row_count,imported_by) values ('92000000-0000-0000-0000-000000000001',-92001,-92001,'fixture.csv',repeat('1',64),1,'92000000-0000-0000-0000-000000000001');
insert into bank_transactions (id,business_id,account_id,import_id,transaction_date,description,amount,fingerprint) overriding system value values (-92001,-92001,-92001,'92000000-0000-0000-0000-000000000001',current_date,'Fixture',-10,repeat('1',64));
insert into bank_accounts (id,business_id,name) overriding system value values (-92002,-92002,'Fixture');
insert into bank_imports (id,business_id,account_id,file_name,source_sha256,row_count,imported_by) values ('92000000-0000-0000-0000-000000000002',-92002,-92002,'fixture.csv',repeat('2',64),1,'92000000-0000-0000-0000-000000000002');
insert into bank_transactions (id,business_id,account_id,import_id,transaction_date,description,amount,fingerprint) overriding system value values (-92002,-92002,-92002,'92000000-0000-0000-0000-000000000002',current_date,'Fixture',-10,repeat('2',64));

insert into bank_accounts (id,business_id,name) overriding system value values (-92003,-92001,'Chase Business Credit Card');
insert into bank_transactions (id,business_id,account_id,import_id,transaction_date,description,amount,fingerprint) overriding system value values
(-92003,-92001,-92001,'92000000-0000-0000-0000-000000000001','2026-09-15','Chase withdrawal',-58,repeat('3',64)),
(-92004,-92001,-92003,'92000000-0000-0000-0000-000000000001','2026-09-15','Chase card payment',58,repeat('4',64));
-- Only the cash ledger exists: matching must not attempt to provision other accounts.
insert into ledger_accounts (business_id,code,name,account_type,normal_balance,system_key)
values (-92001,'1000','Cash and bank','asset','debit','cash');
set local role authenticated;
set local request.jwt.claim.sub = '92000000-0000-0000-0000-000000000002';
select throws_ok($$select create_bank_transfer(-92001,-92003,-92004)$$,'P0001','Not authorized.','foreign owner denied');
set local request.jwt.claim.sub = '92000000-0000-0000-0000-000000000003';
select throws_ok($$select create_bank_transfer(-92001,-92003,-92004)$$,'P0001','Not authorized.','employee denied');
set local request.jwt.claim.sub = '92000000-0000-0000-0000-000000000004';
select throws_ok($$select create_bank_transfer(-92001,-92003,-92004)$$,'P0001','Not authorized.','intern denied');
set local request.jwt.claim.sub = '92000000-0000-0000-0000-000000000001';
select throws_ok($$select create_bank_transfer(-92001,-92003,-92002)$$,'P0001','Both transfer transactions are required.','foreign transaction denied');
select throws_ok($$insert into ledger_accounts (business_id,code,name,account_type,normal_balance,system_key) values (-92001,'9999','Forbidden','asset','debit','forbidden')$$,'42501',null,'ledger insert remains denied to owner');
select lives_ok($$select create_bank_transfer(-92001,-92003,-92004,'Chase card payment')$$,'owner can match September 15 $58 transfer under RLS');
select is((select count(*) from ledger_accounts where business_id=-92001),1::bigint,'no ledger accounts created');
select is((select count(*) from bank_transfer_links where business_id=-92001),1::bigint,'one transfer created');
select is((select count(*) from bank_transactions where id in (-92003,-92004) and status='matched'),2::bigint,'both transactions matched');
select ok((select count(*)=2 and sum(debit)=58 and sum(credit)=58 from journal_lines where business_id=-92001),'balanced $58 journal posted');
select ok((select bool_and((bank_account_id=-92003 and debit=58 and credit=0) or (bank_account_id=-92001 and credit=58 and debit=0)) from journal_lines where business_id=-92001),'journal retains correct bank ownership');
select throws_ok($$select create_bank_transfer(-92001,-92003,-92004)$$,'P0001','Both transfer transactions must be unreviewed.','duplicate matching denied');
reset role;
-- A missing or inactive cash account must fail before writing anything.
insert into bank_transactions (id,business_id,account_id,import_id,transaction_date,description,amount,fingerprint) overriding system value values
(-92005,-92002,-92002,'92000000-0000-0000-0000-000000000002','2026-09-15','Other withdrawal',-58,repeat('5',64));
insert into bank_accounts (id,business_id,name) overriding system value values (-92006,-92002,'Other card');
insert into bank_transactions (id,business_id,account_id,import_id,transaction_date,description,amount,fingerprint) overriding system value values
(-92006,-92002,-92006,'92000000-0000-0000-0000-000000000002','2026-09-15','Other payment',58,repeat('6',64));
set local role authenticated;
set local request.jwt.claim.sub = '92000000-0000-0000-0000-000000000002';
select throws_ok($$select create_bank_transfer(-92002,-92005,-92006)$$,'P0001','The Cash and bank bookkeeping account is missing. Complete bookkeeping setup first.','missing cash cannot use another business cash');
reset role;
insert into ledger_accounts (business_id,code,name,account_type,normal_balance,system_key,active)
values (-92002,'1000','Cash and bank','asset','debit','cash',false);
set local role authenticated;
set local request.jwt.claim.sub = '92000000-0000-0000-0000-000000000002';
select throws_ok($$select create_bank_transfer(-92002,-92005,-92006)$$,'P0001','The Cash and bank bookkeeping account is missing. Complete bookkeeping setup first.','inactive cash denied');
select is((select count(*) from bank_transfer_links where business_id=-92002),0::bigint,'failed transfers create no link');
select is((select count(*) from journal_entries where business_id=-92002),0::bigint,'failed transfers create no journal');
select is((select count(*) from bank_transactions where id in (-92005,-92006) and status='unreviewed'),2::bigint,'failed transfers leave transaction state unchanged');
select * from finish();
rollback;
