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
      accounts: {
        Row: {
          balance: number
          created_at: string | null
          id: string
          kind: string
          name: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string | null
          id?: string
          kind: string
          name: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string | null
          id?: string
          kind?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_insights: {
        Row: {
          created_at: string | null
          id: string
          input_hash: string
          module: string
          payload: Json
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          input_hash: string
          module: string
          payload: Json
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          input_hash?: string
          module?: string
          payload?: Json
          user_id?: string
        }
        Relationships: []
      }
      budgets: {
        Row: {
          category_id: string
          created_at: string | null
          id: string
          month: string
          planned: number
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string | null
          id?: string
          month: string
          planned: number
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string | null
          id?: string
          month?: string
          planned?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      care_schedule: {
        Row: {
          child_days: number
          created_at: string
          cycle_days: number
          cycle_start: string
          handover_weekday: number
          updated_at: string
          user_id: string
        }
        Insert: {
          child_days?: number
          created_at?: string
          cycle_days?: number
          cycle_start: string
          handover_weekday?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          child_days?: number
          created_at?: string
          cycle_days?: number
          cycle_start?: string
          handover_weekday?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string | null
          id: string
          is_fixed: boolean
          kind: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_fixed?: boolean
          kind: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_fixed?: boolean
          kind?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      import_profiles: {
        Row: {
          account_id: string | null
          amount_mode: string
          column_map: Json
          created_at: string
          date_format: string
          delimiter: string
          encoding: string
          header_row: number
          id: string
          name: string
          sign_flip: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount_mode?: string
          column_map?: Json
          created_at?: string
          date_format?: string
          delimiter?: string
          encoding?: string
          header_row?: number
          id?: string
          name: string
          sign_flip?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount_mode?: string
          column_map?: Json
          created_at?: string
          date_format?: string
          delimiter?: string
          encoding?: string
          header_row?: number
          id?: string
          name?: string
          sign_flip?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_profiles_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      intention_events: {
        Row: {
          created_at: string
          due_on: string
          fulfilled: boolean
          id: string
          intention_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          due_on: string
          fulfilled?: boolean
          id?: string
          intention_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          due_on?: string
          fulfilled?: boolean
          id?: string
          intention_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "intention_events_intention_id_fkey"
            columns: ["intention_id"]
            isOneToOne: false
            referencedRelation: "intentions"
            referencedColumns: ["id"]
          },
        ]
      }
      intentions: {
        Row: {
          action_text: string
          active: boolean
          created_at: string
          fulfilled_count: number
          id: string
          missed_count: number
          trigger_config: Json | null
          trigger_text: string
          trigger_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_text: string
          active?: boolean
          created_at?: string
          fulfilled_count?: number
          id?: string
          missed_count?: number
          trigger_config?: Json | null
          trigger_text: string
          trigger_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_text?: string
          active?: boolean
          created_at?: string
          fulfilled_count?: number
          id?: string
          missed_count?: number
          trigger_config?: Json | null
          trigger_text?: string
          trigger_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loan_payments: {
        Row: {
          amount: number
          created_at: string | null
          id: string
          interest_part: number | null
          is_extra: boolean
          loan_id: string
          paid_at: string
          principal_part: number | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          id?: string
          interest_part?: number | null
          is_extra?: boolean
          loan_id: string
          paid_at: string
          principal_part?: number | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          id?: string
          interest_part?: number | null
          is_extra?: boolean
          loan_id?: string
          paid_at?: string
          principal_part?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loan_payments_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      loans: {
        Row: {
          created_at: string | null
          credit_limit: number | null
          current_balance: number
          has_collateral: boolean
          id: string
          interest_daily: boolean
          is_revolving: boolean
          kind: string
          manual_balance: number | null
          manual_balance_at: string | null
          min_payment: number | null
          min_payment_pct: number | null
          monthly_fee: number | null
          name: string
          nominal_rate: number
          notes: string | null
          original_amount: number | null
          payment_day: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          credit_limit?: number | null
          current_balance: number
          has_collateral?: boolean
          id?: string
          interest_daily?: boolean
          is_revolving?: boolean
          kind: string
          manual_balance?: number | null
          manual_balance_at?: string | null
          min_payment?: number | null
          min_payment_pct?: number | null
          monthly_fee?: number | null
          name: string
          nominal_rate: number
          notes?: string | null
          original_amount?: number | null
          payment_day?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          credit_limit?: number | null
          current_balance?: number
          has_collateral?: boolean
          id?: string
          interest_daily?: boolean
          is_revolving?: boolean
          kind?: string
          manual_balance?: number | null
          manual_balance_at?: string | null
          min_payment?: number | null
          min_payment_pct?: number | null
          monthly_fee?: number | null
          name?: string
          nominal_rate?: number
          notes?: string | null
          original_amount?: number | null
          payment_day?: number | null
          user_id?: string
        }
        Relationships: []
      }
      merchant_rules: {
        Row: {
          category_id: string
          created_at: string
          hit_count: number
          id: string
          match_type: string
          pattern: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          hit_count?: number
          id?: string
          match_type?: string
          pattern: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          hit_count?: number
          id?: string
          match_type?: string
          pattern?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_log: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          read_at: string | null
          sent_on: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind: string
          read_at?: string | null
          sent_on: string
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          sent_on?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      parameter_changes: {
        Row: {
          changed_at: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string
        }
        Insert: {
          changed_at?: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id: string
        }
        Update: {
          changed_at?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string
        }
        Relationships: []
      }
      phase_budgets: {
        Row: {
          category_id: string
          created_at: string
          id: string
          phase: string
          planned: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          phase: string
          planned?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          phase?: string
          planned?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "phase_budgets_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      savings_accounts: {
        Row: {
          created_at: string | null
          current_value: number
          id: string
          interest_rate: number | null
          is_buffer: boolean
          kind: string
          name: string
          provider: string | null
          target_value: number | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          current_value?: number
          id?: string
          interest_rate?: number | null
          is_buffer?: boolean
          kind: string
          name: string
          provider?: string | null
          target_value?: number | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          current_value?: number
          id?: string
          interest_rate?: number | null
          is_buffer?: boolean
          kind?: string
          name?: string
          provider?: string | null
          target_value?: number | null
          user_id?: string
        }
        Relationships: []
      }
      savings_snapshots: {
        Row: {
          account_id: string
          created_at: string | null
          deposits_since_last: number
          id: string
          snapshot_date: string
          user_id: string
          value: number
        }
        Insert: {
          account_id: string
          created_at?: string | null
          deposits_since_last?: number
          id?: string
          snapshot_date: string
          user_id: string
          value: number
        }
        Update: {
          account_id?: string
          created_at?: string | null
          deposits_since_last?: number
          id?: string
          snapshot_date?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "savings_snapshots_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "savings_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      scenarios: {
        Row: {
          created_at: string | null
          extra_per_month: number
          id: string
          name: string
          strategy: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          extra_per_month?: number
          id?: string
          name: string
          strategy: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          extra_per_month?: number
          id?: string
          name?: string
          strategy?: string
          user_id?: string
        }
        Relationships: []
      }
      sinking_funds: {
        Row: {
          annual_estimate: number
          created_at: string
          current_balance: number
          id: string
          monthly_accrual: number | null
          name: string
          next_expected: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          annual_estimate: number
          created_at?: string
          current_balance?: number
          id?: string
          monthly_accrual?: number | null
          name: string
          next_expected?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          annual_estimate?: number
          created_at?: string
          current_balance?: number
          id?: string
          monthly_accrual?: number | null
          name?: string
          next_expected?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      transaction_splits: {
        Row: {
          amount: number
          category_id: string | null
          created_at: string
          id: string
          note: string | null
          transaction_id: string
          user_id: string
        }
        Insert: {
          amount: number
          category_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          transaction_id: string
          user_id: string
        }
        Update: {
          amount?: number
          category_id?: string | null
          created_at?: string
          id?: string
          note?: string | null
          transaction_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_splits_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_splits_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string | null
          amount: number
          booking_date: string | null
          category_id: string | null
          created_at: string | null
          description: string | null
          id: string
          import_hash: string | null
          is_locked: boolean
          is_recurring: boolean
          occurred_at: string
          phase: string | null
          phase_override: boolean
          raw_description: string | null
          source: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          booking_date?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          import_hash?: string | null
          is_locked?: boolean
          is_recurring?: boolean
          occurred_at: string
          phase?: string | null
          phase_override?: boolean
          raw_description?: string | null
          source?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          booking_date?: string | null
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          import_hash?: string | null
          is_locked?: boolean
          is_recurring?: boolean
          occurred_at?: string
          phase?: string | null
          phase_override?: boolean
          raw_description?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_parameters: {
        Row: {
          buffer_months: number
          child_allowance_day: number
          child_allowance_share: number
          child_allowance_total: number
          cooldown_large_days: number
          cooldown_large_limit: number
          cooldown_medium_days: number
          cooldown_small_hours: number
          cooldown_small_limit: number
          expected_return: number
          hourly_net_wage: number | null
          isk_fribelopp: number
          isk_schablonranta: number
          kapitalskatt: number
          monthly_net_income: number | null
          notifications_paused_until: string | null
          payday: number
          ranteavdrag_sakerhet: number
          ranteavdrag_utan_sakerhet: number
          updated_at: string
          user_id: string
        }
        Insert: {
          buffer_months?: number
          child_allowance_day?: number
          child_allowance_share?: number
          child_allowance_total?: number
          cooldown_large_days?: number
          cooldown_large_limit?: number
          cooldown_medium_days?: number
          cooldown_small_hours?: number
          cooldown_small_limit?: number
          expected_return?: number
          hourly_net_wage?: number | null
          isk_fribelopp?: number
          isk_schablonranta?: number
          kapitalskatt?: number
          monthly_net_income?: number | null
          notifications_paused_until?: string | null
          payday?: number
          ranteavdrag_sakerhet?: number
          ranteavdrag_utan_sakerhet?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          buffer_months?: number
          child_allowance_day?: number
          child_allowance_share?: number
          child_allowance_total?: number
          cooldown_large_days?: number
          cooldown_large_limit?: number
          cooldown_medium_days?: number
          cooldown_small_hours?: number
          cooldown_small_limit?: number
          expected_return?: number
          hourly_net_wage?: number | null
          isk_fribelopp?: number
          isk_schablonranta?: number
          kapitalskatt?: number
          monthly_net_income?: number | null
          notifications_paused_until?: string | null
          payday?: number
          ranteavdrag_sakerhet?: number
          ranteavdrag_utan_sakerhet?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_reviews: {
        Row: {
          created_at: string
          id: string
          overspent_category_ids: string[]
          phase: string
          phase_start: string
          planned_next: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          overspent_category_ids?: string[]
          phase: string
          phase_start: string
          planned_next?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          overspent_category_ids?: string[]
          phase?: string
          phase_start?: string
          planned_next?: Json
          user_id?: string
        }
        Relationships: []
      }
      wishlist: {
        Row: {
          added_at: string | null
          cooldown_until: string
          decided_at: string | null
          decision: string | null
          id: string
          item: string
          mood: string | null
          price: number
          url: string | null
          user_id: string
        }
        Insert: {
          added_at?: string | null
          cooldown_until: string
          decided_at?: string | null
          decision?: string | null
          id?: string
          item: string
          mood?: string | null
          price: number
          url?: string | null
          user_id: string
        }
        Update: {
          added_at?: string | null
          cooldown_until?: string
          decided_at?: string | null
          decision?: string | null
          id?: string
          item?: string
          mood?: string | null
          price?: number
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
