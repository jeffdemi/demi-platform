export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      bank_accounts: {
        Row: { id: number; business_id: number; name: string; institution: string | null; account_type: string; last_four: string | null; currency: string; active: boolean; created_at: string; updated_at: string }
        Insert: { id?: never; business_id: number; name: string; institution?: string | null; account_type?: string; last_four?: string | null; currency?: string; active?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: never; business_id?: number; name?: string; institution?: string | null; account_type?: string; last_four?: string | null; currency?: string; active?: boolean; created_at?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: "bank_accounts_business_id_fkey"; columns: ["business_id"]; isOneToOne: false; referencedRelation: "businesses"; referencedColumns: ["id"] }]
      }
      bank_statement_periods: {
        Row: { id: number; business_id: number; account_id: number; statement_start_date: string; statement_end_date: string; opening_balance: number; closing_balance: number; notes: string | null; status: string; reconciled_at: string | null; reconciled_by: string | null; closed_at: string | null; closed_by: string | null; created_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: never; business_id: number; account_id: number; statement_start_date: string; statement_end_date: string; opening_balance: number; closing_balance: number; notes?: string | null; status?: string; reconciled_at?: string | null; reconciled_by?: string | null; closed_at?: string | null; closed_by?: string | null; created_by?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: never; business_id?: number; account_id?: number; statement_start_date?: string; statement_end_date?: string; opening_balance?: number; closing_balance?: number; notes?: string | null; status?: string; reconciled_at?: string | null; reconciled_by?: string | null; closed_at?: string | null; closed_by?: string | null; created_by?: string | null; created_at?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: "bank_statement_periods_business_id_account_id_fkey"; columns: ["business_id", "account_id"]; isOneToOne: false; referencedRelation: "bank_accounts"; referencedColumns: ["business_id", "id"] }]
      }
      bank_imports: {
        Row: { id: string; business_id: number; account_id: number; file_name: string; source_sha256: string; row_count: number; imported_by: string; created_at: string }
        Insert: { id?: string; business_id: number; account_id: number; file_name: string; source_sha256: string; row_count: number; imported_by: string; created_at?: string }
        Update: { id?: string; business_id?: number; account_id?: number; file_name?: string; source_sha256?: string; row_count?: number; imported_by?: string; created_at?: string }
        Relationships: [{ foreignKeyName: "bank_imports_business_id_account_id_fkey"; columns: ["business_id", "account_id"]; isOneToOne: false; referencedRelation: "bank_accounts"; referencedColumns: ["business_id", "id"] }]
      }
      bank_transactions: {
        Row: { id: number; business_id: number; account_id: number; import_id: string; statement_period_id: number | null; transaction_date: string; posted_date: string | null; description: string; amount: number; currency: string; external_id: string | null; fingerprint: string; status: string; excluded_reason: string | null; reviewed_at: string | null; reviewed_by: string | null; created_at: string; updated_at: string }
        Insert: { id?: never; business_id: number; account_id: number; import_id: string; statement_period_id?: number | null; transaction_date: string; posted_date?: string | null; description: string; amount: number; currency?: string; external_id?: string | null; fingerprint: string; status?: string; excluded_reason?: string | null; reviewed_at?: string | null; reviewed_by?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: never; business_id?: number; account_id?: number; import_id?: string; statement_period_id?: number | null; transaction_date?: string; posted_date?: string | null; description?: string; amount?: number; currency?: string; external_id?: string | null; fingerprint?: string; status?: string; excluded_reason?: string | null; reviewed_at?: string | null; reviewed_by?: string | null; created_at?: string; updated_at?: string }
        Relationships: [
          { foreignKeyName: "bank_transactions_business_id_account_id_fkey"; columns: ["business_id", "account_id"]; isOneToOne: false; referencedRelation: "bank_accounts"; referencedColumns: ["business_id", "id"] },
          { foreignKeyName: "bank_transactions_statement_period_fkey"; columns: ["business_id", "statement_period_id"]; isOneToOne: false; referencedRelation: "bank_statement_periods"; referencedColumns: ["business_id", "id"] }
        ]
      }
      bank_transaction_allocations: {
        Row: { id: number; business_id: number; bank_transaction_id: number; ledger_account_id: number; amount: number; memo: string; tax_category: string | null; deductible_percent: number; created_by: string | null; created_at: string; voided_at: string | null; voided_by: string | null; void_reason: string | null }
        Insert: { id?: never; business_id: number; bank_transaction_id: number; ledger_account_id: number; amount: number; memo: string; tax_category?: string | null; deductible_percent?: number; created_by?: string | null; created_at?: string; voided_at?: string | null; voided_by?: string | null; void_reason?: string | null }
        Update: { id?: never; business_id?: number; bank_transaction_id?: number; ledger_account_id?: number; amount?: number; memo?: string; tax_category?: string | null; deductible_percent?: number; created_by?: string | null; created_at?: string; voided_at?: string | null; voided_by?: string | null; void_reason?: string | null }
        Relationships: [
          { foreignKeyName: "bank_transaction_allocations_business_id_bank_transaction_id_fkey"; columns: ["business_id", "bank_transaction_id"]; isOneToOne: false; referencedRelation: "bank_transactions"; referencedColumns: ["business_id", "id"] },
          { foreignKeyName: "bank_transaction_allocations_business_id_ledger_account_id_fkey"; columns: ["business_id", "ledger_account_id"]; isOneToOne: false; referencedRelation: "ledger_accounts"; referencedColumns: ["business_id", "id"] }
        ]
      }
      bank_transfer_links: {
        Row: { id: number; business_id: number; outgoing_transaction_id: number; incoming_transaction_id: number; transfer_date: string; amount: number; memo: string | null; status: string; created_by: string | null; created_at: string; voided_at: string | null; voided_by: string | null; void_reason: string | null }
        Insert: { id?: never; business_id: number; outgoing_transaction_id: number; incoming_transaction_id: number; transfer_date: string; amount: number; memo?: string | null; status?: string; created_by?: string | null; created_at?: string; voided_at?: string | null; voided_by?: string | null; void_reason?: string | null }
        Update: { id?: never; business_id?: number; outgoing_transaction_id?: number; incoming_transaction_id?: number; transfer_date?: string; amount?: number; memo?: string | null; status?: string; created_by?: string | null; created_at?: string; voided_at?: string | null; voided_by?: string | null; void_reason?: string | null }
        Relationships: []
      }
      bookkeeping_adjustments: {
        Row: { id: number; business_id: number; entry_date: string; description: string; debit_account_id: number; credit_account_id: number; amount: number; reason: string; status: string; created_by: string | null; created_at: string; voided_at: string | null; voided_by: string | null; void_reason: string | null }
        Insert: { id?: never; business_id: number; entry_date: string; description: string; debit_account_id: number; credit_account_id: number; amount: number; reason: string; status?: string; created_by?: string | null; created_at?: string; voided_at?: string | null; voided_by?: string | null; void_reason?: string | null }
        Update: { id?: never; business_id?: number; entry_date?: string; description?: string; debit_account_id?: number; credit_account_id?: number; amount?: number; reason?: string; status?: string; created_by?: string | null; created_at?: string; voided_at?: string | null; voided_by?: string | null; void_reason?: string | null }
        Relationships: [
          { foreignKeyName: "bookkeeping_adjustments_business_id_debit_account_id_fkey"; columns: ["business_id", "debit_account_id"]; isOneToOne: false; referencedRelation: "ledger_accounts"; referencedColumns: ["business_id", "id"] },
          { foreignKeyName: "bookkeeping_adjustments_business_id_credit_account_id_fkey"; columns: ["business_id", "credit_account_id"]; isOneToOne: false; referencedRelation: "ledger_accounts"; referencedColumns: ["business_id", "id"] }
        ]
      }
      business_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          business_id: number
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: string
          status: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          business_id: number
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: string
          status?: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          business_id?: number
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_invitations_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          active: boolean
          business_id: number
          created_at: string
          id: number
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          business_id: number
          created_at?: string
          id?: never
          role: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          business_id?: number
          created_at?: string
          id?: never
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          active: boolean
          address_line_1: string | null
          address_line_2: string | null
          city: string | null
          created_at: string
          email: string | null
          id: number
          legal_name: string | null
          name: string
          phone: string | null
          postal_code: string | null
          region: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: never
          legal_name?: string | null
          name: string
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address_line_1?: string | null
          address_line_2?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: never
          legal_name?: string | null
          name?: string
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          active: boolean
          business_id: number
          company_name: string | null
          created_at: string
          customer_type: string
          email: string | null
          first_name: string | null
          id: number
          last_name: string | null
          legacy_id: number | null
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: number
          company_name?: string | null
          created_at?: string
          customer_type?: string
          email?: string | null
          first_name?: string | null
          id?: never
          last_name?: string | null
          legacy_id?: number | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: number
          company_name?: string | null
          created_at?: string
          customer_type?: string
          email?: string | null
          first_name?: string | null
          id?: never
          last_name?: string | null
          legacy_id?: number | null
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment: {
        Row: {
          active: boolean
          business_id: number
          created_at: string
          depreciation_method: string | null
          equipment_type: string | null
          hour_meter: number | null
          id: number
          in_service_date: string | null
          legacy_id: number | null
          loan_balance: number | null
          loan_interest_rate: number | null
          loan_lender: string | null
          loan_maturity_date: string | null
          loan_original_amount: number | null
          make_model: string | null
          name: string
          notes: string | null
          purchase_cost: number | null
          purchase_date: string | null
          salvage_value: number | null
          serial_number: string | null
          updated_at: string
          useful_life_months: number | null
        }
        Insert: {
          active?: boolean
          business_id: number
          created_at?: string
          depreciation_method?: string | null
          equipment_type?: string | null
          hour_meter?: number | null
          id?: never
          in_service_date?: string | null
          legacy_id?: number | null
          loan_balance?: number | null
          loan_interest_rate?: number | null
          loan_lender?: string | null
          loan_maturity_date?: string | null
          loan_original_amount?: number | null
          make_model?: string | null
          name: string
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          salvage_value?: number | null
          serial_number?: string | null
          updated_at?: string
          useful_life_months?: number | null
        }
        Update: {
          active?: boolean
          business_id?: number
          created_at?: string
          depreciation_method?: string | null
          equipment_type?: string | null
          hour_meter?: number | null
          id?: never
          in_service_date?: string | null
          legacy_id?: number | null
          loan_balance?: number | null
          loan_interest_rate?: number | null
          loan_lender?: string | null
          loan_maturity_date?: string | null
          loan_original_amount?: number | null
          make_model?: string | null
          name?: string
          notes?: string | null
          purchase_cost?: number | null
          purchase_date?: string | null
          salvage_value?: number | null
          serial_number?: string | null
          updated_at?: string
          useful_life_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "equipment_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          bank_transaction_id: number | null
          business_id: number
          category: string
          created_at: string
          deductible_percent: number
          description: string | null
          equipment_id: number | null
          expense_date: string
          financial_classification: string
          financial_classification_reviewed: boolean
          id: number
          job_id: number | null
          labor_class: string | null
          legacy_id: number | null
          notes: string | null
          payment_method: string | null
          receipt_path: string | null
          receipt_extracted_data: Json | null
          receipt_review_status: string
          receipt_reviewed_at: string | null
          receipt_reviewed_by: string | null
          refund_of_expense_id: number | null
          tax_category: string | null
          transaction_type: string
          updated_at: string
          vendor: string | null
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount: number
          bank_transaction_id?: number | null
          business_id: number
          category: string
          created_at?: string
          deductible_percent?: number
          description?: string | null
          equipment_id?: number | null
          expense_date?: string
          financial_classification?: string
          financial_classification_reviewed?: boolean
          id?: never
          job_id?: number | null
          labor_class?: string | null
          legacy_id?: number | null
          notes?: string | null
          payment_method?: string | null
          receipt_path?: string | null
          receipt_extracted_data?: Json | null
          receipt_review_status?: string
          receipt_reviewed_at?: string | null
          receipt_reviewed_by?: string | null
          refund_of_expense_id?: number | null
          tax_category?: string | null
          transaction_type?: string
          updated_at?: string
          vendor?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount?: number
          bank_transaction_id?: number | null
          business_id?: number
          category?: string
          created_at?: string
          deductible_percent?: number
          description?: string | null
          equipment_id?: number | null
          expense_date?: string
          financial_classification?: string
          financial_classification_reviewed?: boolean
          id?: never
          job_id?: number | null
          labor_class?: string | null
          legacy_id?: number | null
          notes?: string | null
          payment_method?: string | null
          receipt_path?: string | null
          receipt_extracted_data?: Json | null
          receipt_review_status?: string
          receipt_reviewed_at?: string | null
          receipt_reviewed_by?: string | null
          refund_of_expense_id?: number | null
          tax_category?: string | null
          transaction_type?: string
          updated_at?: string
          vendor?: string | null
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_business_id_equipment_id_fkey"
            columns: ["business_id", "equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "expenses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_business_id_job_id_fkey"
            columns: ["business_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "expenses_refund_source_fkey"
            columns: ["business_id", "refund_of_expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      financial_settings: {
        Row: {
          id: number
          business_id: number
          owner_market_salary_annual: number | null
          owner_labor_class: string
          has_non_owner_labor: boolean
          reporting_basis: string
          target_total_ler: number
          minimum_profit_to_gross_margin: number
          target_profit_to_gross_margin: number
          stretch_profit_to_gross_margin: number
          core_capital_months: number
          minimum_roic: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: never
          business_id: number
          owner_market_salary_annual?: number | null
          owner_labor_class?: string
          has_non_owner_labor?: boolean
          reporting_basis?: string
          target_total_ler?: number
          minimum_profit_to_gross_margin?: number
          target_profit_to_gross_margin?: number
          stretch_profit_to_gross_margin?: number
          core_capital_months?: number
          minimum_roic?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: never
          business_id?: number
          owner_market_salary_annual?: number | null
          owner_labor_class?: string
          has_non_owner_labor?: boolean
          reporting_basis?: string
          target_total_ler?: number
          minimum_profit_to_gross_margin?: number
          target_profit_to_gross_margin?: number
          stretch_profit_to_gross_margin?: number
          core_capital_months?: number
          minimum_roic?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [{ foreignKeyName: "financial_settings_business_id_fkey"; columns: ["business_id"]; isOneToOne: false; referencedRelation: "businesses"; referencedColumns: ["id"] }]
      }
      invoices: {
        Row: {
          amount: number
          business_id: number
          created_at: string
          customer_id: number
          due_date: string | null
          id: number
          invoice_date: string
          invoice_number: string
          job_id: number | null
          legacy_id: number | null
          notes: string | null
          paid_date: string | null
          payment_terms: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount?: number
          business_id: number
          created_at?: string
          customer_id: number
          due_date?: string | null
          id?: never
          invoice_date?: string
          invoice_number: string
          job_id?: number | null
          legacy_id?: number | null
          notes?: string | null
          paid_date?: string | null
          payment_terms?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          business_id?: number
          created_at?: string
          customer_id?: number
          due_date?: string | null
          id?: never
          invoice_date?: string
          invoice_number?: string
          job_id?: number | null
          legacy_id?: number | null
          notes?: string | null
          paid_date?: string | null
          payment_terms?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_business_id_customer_id_fkey"
            columns: ["business_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "invoices_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_business_id_job_id_fkey"
            columns: ["business_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      journal_entries: {
        Row: { id: number; business_id: number; entry_date: string; description: string; source_type: string; source_id: number | null; revision: number; status: string; created_by: string | null; created_at: string }
        Insert: { id?: never; business_id: number; entry_date: string; description: string; source_type: string; source_id?: number | null; revision?: number; status?: string; created_by?: string | null; created_at?: string }
        Update: { id?: never; business_id?: number; entry_date?: string; description?: string; source_type?: string; source_id?: number | null; revision?: number; status?: string; created_by?: string | null; created_at?: string }
        Relationships: [{ foreignKeyName: "journal_entries_business_id_fkey"; columns: ["business_id"]; isOneToOne: false; referencedRelation: "businesses"; referencedColumns: ["id"] }]
      }
      journal_lines: {
        Row: { id: number; business_id: number; journal_entry_id: number; account_id: number; bank_account_id: number | null; debit: number; credit: number; memo: string | null; created_at: string }
        Insert: { id?: never; business_id: number; journal_entry_id: number; account_id: number; bank_account_id?: number | null; debit?: number; credit?: number; memo?: string | null; created_at?: string }
        Update: { id?: never; business_id?: number; journal_entry_id?: number; account_id?: number; bank_account_id?: number | null; debit?: number; credit?: number; memo?: string | null; created_at?: string }
        Relationships: [
          { foreignKeyName: "journal_lines_business_id_journal_entry_id_fkey"; columns: ["business_id", "journal_entry_id"]; isOneToOne: false; referencedRelation: "journal_entries"; referencedColumns: ["business_id", "id"] },
          { foreignKeyName: "journal_lines_business_id_account_id_fkey"; columns: ["business_id", "account_id"]; isOneToOne: false; referencedRelation: "ledger_accounts"; referencedColumns: ["business_id", "id"] },
          { foreignKeyName: "journal_lines_bank_account_fkey"; columns: ["business_id", "bank_account_id"]; isOneToOne: false; referencedRelation: "bank_accounts"; referencedColumns: ["business_id", "id"] }
        ]
      }
      jobs: {
        Row: {
          amount_paid: number | null
          amount_quoted: number | null
          business_id: number
          cleanup_minutes: number | null
          completed_date: string | null
          created_at: string
          customer_id: number
          estimated_duration_minutes: number | null
          grinding_minutes: number | null
          hazard_notes: string | null
          id: number
          import_fingerprint: string | null
          job_date: string | null
          legacy_id: number | null
          location_description: string | null
          machine_hours: number | null
          municipality: string | null
          notes: string | null
          pa811_required: boolean
          paid_date: string | null
          payment_method: string | null
          pro_bono: boolean
          property_location: string | null
          quote_id: number | null
          referral_source: string | null
          scheduled_date: string | null
          scheduled_start_time: string | null
          service_address: string | null
          source_job_number: string | null
          status: string
          travel_minutes: number | null
          updated_at: string
          work_description: string | null
        }
        Insert: {
          amount_paid?: number | null
          amount_quoted?: number | null
          business_id: number
          cleanup_minutes?: number | null
          completed_date?: string | null
          created_at?: string
          customer_id: number
          estimated_duration_minutes?: number | null
          grinding_minutes?: number | null
          hazard_notes?: string | null
          id?: never
          import_fingerprint?: string | null
          job_date?: string | null
          legacy_id?: number | null
          location_description?: string | null
          machine_hours?: number | null
          municipality?: string | null
          notes?: string | null
          pa811_required?: boolean
          paid_date?: string | null
          payment_method?: string | null
          pro_bono?: boolean
          property_location?: string | null
          quote_id?: number | null
          referral_source?: string | null
          scheduled_date?: string | null
          scheduled_start_time?: string | null
          service_address?: string | null
          source_job_number?: string | null
          status?: string
          travel_minutes?: number | null
          updated_at?: string
          work_description?: string | null
        }
        Update: {
          amount_paid?: number | null
          amount_quoted?: number | null
          business_id?: number
          cleanup_minutes?: number | null
          completed_date?: string | null
          created_at?: string
          customer_id?: number
          estimated_duration_minutes?: number | null
          grinding_minutes?: number | null
          hazard_notes?: string | null
          id?: never
          import_fingerprint?: string | null
          job_date?: string | null
          legacy_id?: number | null
          location_description?: string | null
          machine_hours?: number | null
          municipality?: string | null
          notes?: string | null
          pa811_required?: boolean
          paid_date?: string | null
          payment_method?: string | null
          pro_bono?: boolean
          property_location?: string | null
          quote_id?: number | null
          referral_source?: string | null
          scheduled_date?: string | null
          scheduled_start_time?: string | null
          service_address?: string | null
          source_job_number?: string | null
          status?: string
          travel_minutes?: number | null
          updated_at?: string
          work_description?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_business_id_customer_id_fkey"
            columns: ["business_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "jobs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "jobs_business_id_quote_id_fkey"
            columns: ["business_id", "quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
      labor_entries: {
        Row: {
          id: number; business_id: number; job_id: number | null; worker_name: string; worker_type: string;
          labor_class: string; period_start: string; period_end: string; paid_date: string | null;
          regular_hours: number; overtime_hours: number; gross_wages: number; employer_payroll_taxes: number;
          benefits: number; source: string; notes: string | null; voided_at: string | null;
          voided_by: string | null; void_reason: string | null; created_by: string | null;
          created_at: string; updated_at: string
        }
        Insert: {
          id?: never; business_id: number; job_id?: number | null; worker_name: string; worker_type?: string;
          labor_class: string; period_start: string; period_end: string; paid_date?: string | null;
          regular_hours?: number; overtime_hours?: number; gross_wages?: number; employer_payroll_taxes?: number;
          benefits?: number; source?: string; notes?: string | null; voided_at?: string | null;
          voided_by?: string | null; void_reason?: string | null; created_by?: string | null;
          created_at?: string; updated_at?: string
        }
        Update: {
          id?: never; business_id?: number; job_id?: number | null; worker_name?: string; worker_type?: string;
          labor_class?: string; period_start?: string; period_end?: string; paid_date?: string | null;
          regular_hours?: number; overtime_hours?: number; gross_wages?: number; employer_payroll_taxes?: number;
          benefits?: number; source?: string; notes?: string | null; voided_at?: string | null;
          voided_by?: string | null; void_reason?: string | null; created_by?: string | null;
          created_at?: string; updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "labor_entries_business_id_fkey"; columns: ["business_id"]; isOneToOne: false; referencedRelation: "businesses"; referencedColumns: ["id"] },
          { foreignKeyName: "labor_entries_business_id_job_id_fkey"; columns: ["business_id", "job_id"]; isOneToOne: false; referencedRelation: "jobs"; referencedColumns: ["business_id", "id"] }
        ]
      }
      ledger_accounts: {
        Row: { id: number; business_id: number; code: string; name: string; account_type: string; normal_balance: string; system_key: string | null; active: boolean; created_at: string; updated_at: string }
        Insert: { id?: never; business_id: number; code: string; name: string; account_type: string; normal_balance: string; system_key?: string | null; active?: boolean; created_at?: string; updated_at?: string }
        Update: { id?: never; business_id?: number; code?: string; name?: string; account_type?: string; normal_balance?: string; system_key?: string | null; active?: boolean; created_at?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: "ledger_accounts_business_id_fkey"; columns: ["business_id"]; isOneToOne: false; referencedRelation: "businesses"; referencedColumns: ["id"] }]
      }
      job_imports: {
        Row: {
          business_id: number
          created_at: string
          created_by: string | null
          customers_created: number
          customers_updated: number
          duplicates_skipped: number
          file_name: string
          id: number
          jobs_created: number
          row_count: number
          source_sha256: string
        }
        Insert: {
          business_id: number
          created_at?: string
          created_by: string
          customers_created?: number
          customers_updated?: number
          duplicates_skipped?: number
          file_name: string
          id?: never
          jobs_created?: number
          row_count: number
          source_sha256: string
        }
        Update: {
          business_id?: number
          created_at?: string
          created_by?: string | null
          customers_created?: number
          customers_updated?: number
          duplicates_skipped?: number
          file_name?: string
          id?: never
          jobs_created?: number
          row_count?: number
          source_sha256?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_imports_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_imports: {
        Row: {
          business_id: number
          id: number
          imported_at: string
          row_counts: Json
          source_name: string
          source_sha256: string
        }
        Insert: {
          business_id: number
          id?: never
          imported_at?: string
          row_counts: Json
          source_name: string
          source_sha256: string
        }
        Update: {
          business_id?: number
          id?: never
          imported_at?: string
          row_counts?: Json
          source_name?: string
          source_sha256?: string
        }
        Relationships: [
          {
            foreignKeyName: "legacy_imports_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      maintenance: {
        Row: {
          business_id: number
          cost: number | null
          created_at: string
          equipment_id: number
          hour_meter: number | null
          id: number
          legacy_id: number | null
          next_due_date: string | null
          next_due_hours: number | null
          notes: string | null
          service_date: string
          service_type: string
          updated_at: string
        }
        Insert: {
          business_id: number
          cost?: number | null
          created_at?: string
          equipment_id: number
          hour_meter?: number | null
          id?: never
          legacy_id?: number | null
          next_due_date?: string | null
          next_due_hours?: number | null
          notes?: string | null
          service_date: string
          service_type: string
          updated_at?: string
        }
        Update: {
          business_id?: number
          cost?: number | null
          created_at?: string
          equipment_id?: number
          hour_meter?: number | null
          id?: never
          legacy_id?: number | null
          next_due_date?: string | null
          next_due_hours?: number | null
          notes?: string | null
          service_date?: string
          service_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_business_id_equipment_id_fkey"
            columns: ["business_id", "equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "maintenance_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_financial_snapshots: {
        Row: {
          id: number; business_id: number; period_month: string; cash_book_balance: number; cash_bank_balance: number;
          accounts_receivable: number; accounts_payable: number; inventory: number; taxes_payable: number;
          credit_card_balance: number; short_term_debt: number; long_term_debt: number; fixed_assets_net: number;
          notes: string | null; reconciled_at: string | null; reconciled_by: string | null; close_status: string;
          closed_at: string | null; closed_by: string | null; reopened_at: string | null; reopened_by: string | null;
          reopen_reason: string | null; created_by: string | null;
          created_at: string; updated_at: string
        }
        Insert: {
          id?: never; business_id: number; period_month: string; cash_book_balance?: number; cash_bank_balance?: number;
          accounts_receivable?: number; accounts_payable?: number; inventory?: number; taxes_payable?: number;
          credit_card_balance?: number; short_term_debt?: number; long_term_debt?: number; fixed_assets_net?: number;
          notes?: string | null; reconciled_at?: string | null; reconciled_by?: string | null; close_status?: string;
          closed_at?: string | null; closed_by?: string | null; reopened_at?: string | null; reopened_by?: string | null;
          reopen_reason?: string | null; created_by?: string | null;
          created_at?: string; updated_at?: string
        }
        Update: {
          id?: never; business_id?: number; period_month?: string; cash_book_balance?: number; cash_bank_balance?: number;
          accounts_receivable?: number; accounts_payable?: number; inventory?: number; taxes_payable?: number;
          credit_card_balance?: number; short_term_debt?: number; long_term_debt?: number; fixed_assets_net?: number;
          notes?: string | null; reconciled_at?: string | null; reconciled_by?: string | null; close_status?: string;
          closed_at?: string | null; closed_by?: string | null; reopened_at?: string | null; reopened_by?: string | null;
          reopen_reason?: string | null; created_by?: string | null;
          created_at?: string; updated_at?: string
        }
        Relationships: [{ foreignKeyName: "monthly_financial_snapshots_business_id_fkey"; columns: ["business_id"]; isOneToOne: false; referencedRelation: "businesses"; referencedColumns: ["id"] }]
      }
      owner_compensation_periods: {
        Row: {
          id: number; business_id: number; period_month: string; market_salary_amount: number; actual_wages: number;
          distributions: number; contributions: number; notes: string | null; created_by: string | null;
          created_at: string; updated_at: string
        }
        Insert: {
          id?: never; business_id: number; period_month: string; market_salary_amount?: number; actual_wages?: number;
          distributions?: number; contributions?: number; notes?: string | null; created_by?: string | null;
          created_at?: string; updated_at?: string
        }
        Update: {
          id?: never; business_id?: number; period_month?: string; market_salary_amount?: number; actual_wages?: number;
          distributions?: number; contributions?: number; notes?: string | null; created_by?: string | null;
          created_at?: string; updated_at?: string
        }
        Relationships: [{ foreignKeyName: "owner_compensation_periods_business_id_fkey"; columns: ["business_id"]; isOneToOne: false; referencedRelation: "businesses"; referencedColumns: ["id"] }]
      }
      payments: {
        Row: { id: number; business_id: number; customer_id: number | null; invoice_id: number | null; job_id: number | null; bank_transaction_id: number | null; payment_date: string; amount: number; method: string | null; reference: string | null; source: string; notes: string | null; voided_at: string | null; voided_by: string | null; void_reason: string | null; created_at: string; updated_at: string }
        Insert: { id?: never; business_id: number; customer_id?: number | null; invoice_id?: number | null; job_id?: number | null; bank_transaction_id?: number | null; payment_date?: string; amount: number; method?: string | null; reference?: string | null; source?: string; notes?: string | null; voided_at?: string | null; voided_by?: string | null; void_reason?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: never; business_id?: number; customer_id?: number | null; invoice_id?: number | null; job_id?: number | null; bank_transaction_id?: number | null; payment_date?: string; amount?: number; method?: string | null; reference?: string | null; source?: string; notes?: string | null; voided_at?: string | null; voided_by?: string | null; void_reason?: string | null; created_at?: string; updated_at?: string }
        Relationships: [
          { foreignKeyName: "payments_business_id_invoice_id_fkey"; columns: ["business_id", "invoice_id"]; isOneToOne: false; referencedRelation: "invoices"; referencedColumns: ["business_id", "id"] },
          { foreignKeyName: "payments_business_id_job_id_fkey"; columns: ["business_id", "job_id"]; isOneToOne: false; referencedRelation: "jobs"; referencedColumns: ["business_id", "id"] },
          { foreignKeyName: "payments_business_id_customer_id_fkey"; columns: ["business_id", "customer_id"]; isOneToOne: false; referencedRelation: "customers"; referencedColumns: ["business_id", "id"] }
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      quote_ai_messages: {
        Row: {
          business_id: number
          content: string
          created_at: string
          created_by: string | null
          id: number
          quote_id: number
          recommendation_id: number | null
          role: string
          thread_id: number
        }
        Insert: {
          business_id: number
          content: string
          created_at?: string
          created_by: string
          id?: never
          quote_id: number
          recommendation_id?: number | null
          role: string
          thread_id: number
        }
        Update: {
          business_id?: number
          content?: string
          created_at?: string
          created_by?: string | null
          id?: never
          quote_id?: number
          recommendation_id?: number | null
          role?: string
          thread_id?: number
        }
        Relationships: [
          { foreignKeyName: "quote_ai_messages_business_quote_fkey"; columns: ["business_id", "quote_id"]; isOneToOne: false; referencedRelation: "quotes"; referencedColumns: ["business_id", "id"] },
          { foreignKeyName: "quote_ai_messages_business_thread_fkey"; columns: ["business_id", "thread_id"]; isOneToOne: false; referencedRelation: "quote_ai_threads"; referencedColumns: ["business_id", "id"] },
          { foreignKeyName: "quote_ai_messages_business_recommendation_fkey"; columns: ["business_id", "recommendation_id"]; isOneToOne: false; referencedRelation: "quote_ai_recommendations"; referencedColumns: ["business_id", "id"] },
        ]
      }
      quote_ai_recommendations: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          assumptions: Json
          business_id: number
          confidence: string
          created_at: string
          created_by: string | null
          customer_message_draft: string | null
          id: number
          model: string
          observations: Json
          prompt_version: string
          questions: Json
          quote_id: number
          readiness: string
          recommended_price: number | null
          response_id: string | null
          risk_flags: Json
          suggested_price_high: number | null
          suggested_price_low: number | null
          suggested_scope: string | null
          thread_id: number
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          assumptions?: Json
          business_id: number
          confidence: string
          created_at?: string
          created_by: string
          customer_message_draft?: string | null
          id?: never
          model: string
          observations?: Json
          prompt_version: string
          questions?: Json
          quote_id: number
          readiness: string
          recommended_price?: number | null
          response_id?: string | null
          risk_flags?: Json
          suggested_price_high?: number | null
          suggested_price_low?: number | null
          suggested_scope?: string | null
          thread_id: number
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          assumptions?: Json
          business_id?: number
          confidence?: string
          created_at?: string
          created_by?: string | null
          customer_message_draft?: string | null
          id?: never
          model?: string
          observations?: Json
          prompt_version?: string
          questions?: Json
          quote_id?: number
          readiness?: string
          recommended_price?: number | null
          response_id?: string | null
          risk_flags?: Json
          suggested_price_high?: number | null
          suggested_price_low?: number | null
          suggested_scope?: string | null
          thread_id?: number
        }
        Relationships: [
          { foreignKeyName: "quote_ai_recommendations_business_quote_fkey"; columns: ["business_id", "quote_id"]; isOneToOne: false; referencedRelation: "quotes"; referencedColumns: ["business_id", "id"] },
          { foreignKeyName: "quote_ai_recommendations_business_thread_fkey"; columns: ["business_id", "thread_id"]; isOneToOne: false; referencedRelation: "quote_ai_threads"; referencedColumns: ["business_id", "id"] },
        ]
      }
      quote_ai_threads: {
        Row: {
          business_id: number
          created_at: string
          created_by: string | null
          id: number
          model: string
          prompt_version: string
          quote_id: number
          updated_at: string
        }
        Insert: {
          business_id: number
          created_at?: string
          created_by: string
          id?: never
          model: string
          prompt_version: string
          quote_id: number
          updated_at?: string
        }
        Update: {
          business_id?: number
          created_at?: string
          created_by?: string | null
          id?: never
          model?: string
          prompt_version?: string
          quote_id?: number
          updated_at?: string
        }
        Relationships: [
          { foreignKeyName: "quote_ai_threads_business_quote_fkey"; columns: ["business_id", "quote_id"]; isOneToOne: true; referencedRelation: "quotes"; referencedColumns: ["business_id", "id"] },
        ]
      }
      quote_photos: {
        Row: {
          business_id: number
          created_at: string
          id: number
          mime_type: string
          original_name: string
          quote_id: number
          size_bytes: number
          storage_path: string
          uploaded_by: string | null
        }
        Insert: {
          business_id: number
          created_at?: string
          id?: never
          mime_type: string
          original_name: string
          quote_id: number
          size_bytes: number
          storage_path: string
          uploaded_by: string
        }
        Update: {
          business_id?: number
          created_at?: string
          id?: never
          mime_type?: string
          original_name?: string
          quote_id?: number
          size_bytes?: number
          storage_path?: string
          uploaded_by?: string | null
        }
        Relationships: [
          { foreignKeyName: "quote_photos_business_quote_fkey"; columns: ["business_id", "quote_id"]; isOneToOne: false; referencedRelation: "quotes"; referencedColumns: ["business_id", "id"] },
        ]
      }
      quotes: {
        Row: {
          acceptance_notes: string | null
          accepted_method: string | null
          business_id: number
          contact_method: string | null
          created_at: string
          customer_id: number
          customer_scope: string | null
          discount_reason: string | null
          expiration_date: string | null
          hazard_notes: string | null
          id: number
          internal_notes: string | null
          job_id: number | null
          legacy_id: number | null
          location_description: string | null
          municipality: string | null
          normal_price: number | null
          pa811_required: boolean
          pro_bono: boolean
          property_location: string | null
          quote_date: string
          quote_number: string
          quoted_price: number
          referral_source: string | null
          response_date: string | null
          sent_date: string | null
          service_address: string | null
          status: string
          updated_at: string
        }
        Insert: {
          acceptance_notes?: string | null
          accepted_method?: string | null
          business_id: number
          contact_method?: string | null
          created_at?: string
          customer_id: number
          customer_scope?: string | null
          discount_reason?: string | null
          expiration_date?: string | null
          hazard_notes?: string | null
          id?: never
          internal_notes?: string | null
          job_id?: number | null
          legacy_id?: number | null
          location_description?: string | null
          municipality?: string | null
          normal_price?: number | null
          pa811_required?: boolean
          pro_bono?: boolean
          property_location?: string | null
          quote_date?: string
          quote_number: string
          quoted_price?: number
          referral_source?: string | null
          response_date?: string | null
          sent_date?: string | null
          service_address?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          acceptance_notes?: string | null
          accepted_method?: string | null
          business_id?: number
          contact_method?: string | null
          created_at?: string
          customer_id?: number
          customer_scope?: string | null
          discount_reason?: string | null
          expiration_date?: string | null
          hazard_notes?: string | null
          id?: never
          internal_notes?: string | null
          job_id?: number | null
          legacy_id?: number | null
          location_description?: string | null
          municipality?: string | null
          normal_price?: number | null
          pa811_required?: boolean
          pro_bono?: boolean
          property_location?: string | null
          quote_date?: string
          quote_number?: string
          quoted_price?: number
          referral_source?: string | null
          response_date?: string | null
          sent_date?: string | null
          service_address?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quotes_business_id_customer_id_fkey"
            columns: ["business_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["business_id", "id"]
          },
          {
            foreignKeyName: "quotes_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_business_job_fkey"
            columns: ["business_id", "job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["business_id", "id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_bank_transaction_allocation: {
        Args: { target_business_id: number; target_bank_transaction_id: number; target_ledger_account_id: number; allocation_amount: number; allocation_memo: string; allocation_tax_category?: string | null; allocation_deductible_percent?: number }
        Returns: number
      }
      add_maintenance_record: {
        Args: {
          due_hours?: number
          due_on?: string
          maintenance_cost?: number
          maintenance_notes?: string
          maintenance_type: string
          meter_hours?: number
          serviced_on: string
          target_business_id: number
          target_equipment_id: number
        }
        Returns: number
      }
      accept_business_invitation: {
        Args: { invitation_id: string; member_full_name?: string }
        Returns: number
      }
      create_business: { Args: { business_name: string }; Returns: number }
      create_bank_transfer: {
        Args: { target_business_id: number; target_outgoing_transaction_id: number; target_incoming_transaction_id: number; target_memo?: string | null }
        Returns: number
      }
      create_bookkeeping_adjustment: {
        Args: { target_business_id: number; adjustment_date: string; adjustment_description: string; target_debit_account_id: number; target_credit_account_id: number; adjustment_amount: number; adjustment_reason: string }
        Returns: number
      }
      convert_quote_to_job: { Args: { target_quote_id: number }; Returns: number }
      create_invoice_record: {
        Args: {
          due_on?: string
          invoice_amount: number
          invoice_notes?: string
          invoice_on: string
          invoice_status: string
          paid_on?: string
          target_business_id: number
          target_customer_id: number
          target_job_id?: number
          terms?: string
        }
        Returns: number
      }
      import_legacy_snapshot: {
        Args: {
          import_payload: Json
          import_source_name: string
          import_source_sha256: string
          target_business_id: number
        }
        Returns: Json
      }
      import_job_spreadsheet: {
        Args: {
          import_file_name: string
          import_rows: Json
          import_source_sha256: string
          target_business_id: number
        }
        Returns: Json
      }
      import_bank_statement: {
        Args: {
          import_file_name: string
          import_rows: Json
          import_source_sha256: string
          target_account_id: number
          target_business_id: number
        }
        Returns: Json
      }
      platform_setup_available: { Args: never; Returns: boolean }
      reconcile_bank_statement_period: {
        Args: { target_business_id: number; target_period_id: number }
        Returns: Json
      }
      record_payment: {
        Args: {
          payment_amount: number
          payment_method: string | null
          payment_notes: string | null
          payment_on: string
          payment_reference: string | null
          target_bank_transaction_id: number | null
          target_business_id: number
          target_invoice_id: number | null
          target_job_id: number | null
        }
        Returns: number
      }
      save_bank_statement_period: {
        Args: { target_business_id: number; target_account_id: number; statement_start: string; statement_end: string; statement_opening_balance: number; statement_closing_balance: number; statement_notes?: string | null }
        Returns: number
      }
      close_accounting_month: {
        Args: { target_business_id: number; target_period_month: string }
        Returns: undefined
      }
      reopen_accounting_month: {
        Args: { target_business_id: number; target_period_month: string; target_reason: string }
        Returns: undefined
      }
      void_bank_transaction_allocation: {
        Args: { target_business_id: number; target_allocation_id: number; target_reason: string }
        Returns: undefined
      }
      set_invoice_status: {
        Args: { invoice_status: string; paid_on?: string; target_invoice_id: number }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
