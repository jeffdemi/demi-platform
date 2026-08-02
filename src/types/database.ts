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
          equipment_type: string | null
          hour_meter: number | null
          id: number
          legacy_id: number | null
          make_model: string | null
          name: string
          notes: string | null
          serial_number: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          business_id: number
          created_at?: string
          equipment_type?: string | null
          hour_meter?: number | null
          id?: never
          legacy_id?: number | null
          make_model?: string | null
          name: string
          notes?: string | null
          serial_number?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          business_id?: number
          created_at?: string
          equipment_type?: string | null
          hour_meter?: number | null
          id?: never
          legacy_id?: number | null
          make_model?: string | null
          name?: string
          notes?: string | null
          serial_number?: string | null
          updated_at?: string
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
          business_id: number
          category: string
          created_at: string
          description: string | null
          equipment_id: number | null
          expense_date: string
          id: number
          job_id: number | null
          legacy_id: number | null
          notes: string | null
          payment_method: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount: number
          business_id: number
          category: string
          created_at?: string
          description?: string | null
          equipment_id?: number | null
          expense_date?: string
          id?: never
          job_id?: number | null
          legacy_id?: number | null
          notes?: string | null
          payment_method?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          business_id?: number
          category?: string
          created_at?: string
          description?: string | null
          equipment_id?: number | null
          expense_date?: string
          id?: never
          job_id?: number | null
          legacy_id?: number | null
          notes?: string | null
          payment_method?: string | null
          updated_at?: string
          vendor?: string | null
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
        ]
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
      create_business: { Args: { business_name: string }; Returns: number }
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
