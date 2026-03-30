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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      analytics_snapshots: {
        Row: {
          id: string
          metadata: Json
          metric_type: string
          metric_value: number
          org_id: string
          snapshot_date: string
        }
        Insert: {
          id?: string
          metadata?: Json
          metric_type: string
          metric_value: number
          org_id: string
          snapshot_date?: string
        }
        Update: {
          id?: string
          metadata?: Json
          metric_type?: string
          metric_value?: number
          org_id?: string
          snapshot_date?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_snapshots_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      assignments: {
        Row: {
          assigned_by: string
          assigned_to: string
          assigner_note: string | null
          created_at: string
          due_date: string | null
          group_id: string | null
          id: string
          org_id: string
          plan_id: string
          scheduled_for: string | null
          status: string
        }
        Insert: {
          assigned_by: string
          assigned_to: string
          assigner_note?: string | null
          created_at?: string
          due_date?: string | null
          group_id?: string | null
          id?: string
          org_id: string
          plan_id: string
          scheduled_for?: string | null
          status?: string
        }
        Update: {
          assigned_by?: string
          assigned_to?: string
          assigner_note?: string | null
          created_at?: string
          due_date?: string | null
          group_id?: string | null
          id?: string
          org_id?: string
          plan_id?: string
          scheduled_for?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "assignments_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assignments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      content_embeddings: {
        Row: {
          chunk_index: number
          chunk_text: string
          content_item_id: string
          created_at: string
          embedding: string
          id: string
          org_id: string
        }
        Insert: {
          chunk_index: number
          chunk_text: string
          content_item_id: string
          created_at?: string
          embedding: string
          id?: string
          org_id: string
        }
        Update: {
          chunk_index?: number
          chunk_text?: string
          content_item_id?: string
          created_at?: string
          embedding?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_embeddings_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_embeddings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      content_items: {
        Row: {
          created_at: string
          file_path: string | null
          id: string
          metadata: Json
          org_id: string
          source_type: string
          source_url: string | null
          status: string
          title: string
          transcript: string | null
          transcript_chunks: Json | null
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_path?: string | null
          id?: string
          metadata?: Json
          org_id: string
          source_type: string
          source_url?: string | null
          status?: string
          title: string
          transcript?: string | null
          transcript_chunks?: Json | null
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_path?: string | null
          id?: string
          metadata?: Json
          org_id?: string
          source_type?: string
          source_url?: string | null
          status?: string
          title?: string
          transcript?: string | null
          transcript_chunks?: Json | null
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_items_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          created_by: string
          id: string
          name: string
          org_id: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          name: string
          org_id: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          name?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "groups_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      insight_reports: {
        Row: {
          ai_content: string | null
          delivered_at: string | null
          generated_at: string
          id: string
          org_id: string
          pdf_url: string | null
          period_end: string
          period_start: string
          report_type: string
        }
        Insert: {
          ai_content?: string | null
          delivered_at?: string | null
          generated_at?: string
          id?: string
          org_id: string
          pdf_url?: string | null
          period_end: string
          period_start: string
          report_type: string
        }
        Update: {
          ai_content?: string | null
          delivered_at?: string | null
          generated_at?: string
          id?: string
          org_id?: string
          pdf_url?: string | null
          period_end?: string
          period_start?: string
          report_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "insight_reports_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          created_at: string
          email: string
          id: string
          invited_by: string | null
          org_id: string
          role: string
          status: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          org_id: string
          role?: string
          status?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          role?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_suppressions: {
        Row: {
          id: string
          notification_type: string
          suppressed_until: string
          user_id: string
        }
        Insert: {
          id?: string
          notification_type: string
          suppressed_until: string
          user_id: string
        }
        Update: {
          id?: string
          notification_type?: string
          suppressed_until?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_suppressions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: string
          created_at: string
          delivered_at: string | null
          id: string
          org_id: string
          payload: Json
          sent_at: string | null
          slack_message_ts: string | null
          teams_activity_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          channel: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          org_id: string
          payload?: Json
          sent_at?: string | null
          slack_message_ts?: string | null
          teams_activity_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          channel?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          org_id?: string
          payload?: Json
          sent_at?: string | null
          slack_message_ts?: string | null
          teams_activity_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          created_at: string
          id: string
          industry: string | null
          logo_url: string | null
          name: string
          onboarding_completed: boolean
          org_context: Json
          size: string | null
          slack_team_id: string | null
          teams_tenant_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          industry?: string | null
          logo_url?: string | null
          name: string
          onboarding_completed?: boolean
          org_context?: Json
          size?: string | null
          slack_team_id?: string | null
          teams_tenant_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          industry?: string | null
          logo_url?: string | null
          name?: string
          onboarding_completed?: boolean
          org_context?: Json
          size?: string | null
          slack_team_id?: string | null
          teams_tenant_id?: string | null
        }
        Relationships: []
      }
      plan_embeddings: {
        Row: {
          created_at: string
          embedding: string
          id: string
          is_admin_approved: boolean
          org_id: string
          plan_id: string
          plan_text: string
        }
        Insert: {
          created_at?: string
          embedding: string
          id?: string
          is_admin_approved?: boolean
          org_id: string
          plan_id: string
          plan_text: string
        }
        Update: {
          created_at?: string
          embedding?: string
          id?: string
          is_admin_approved?: boolean
          org_id?: string
          plan_id?: string
          plan_text?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_embeddings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_embeddings_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_steps: {
        Row: {
          created_at: string
          estimated_minutes: number | null
          id: string
          instructions: string
          plan_id: string
          proof_instructions: string
          proof_type: string
          step_number: number
          success_criteria: string
          title: string
          video_timestamp_end: number | null
          video_timestamp_start: number | null
        }
        Insert: {
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          instructions: string
          plan_id: string
          proof_instructions?: string
          proof_type?: string
          step_number: number
          success_criteria: string
          title: string
          video_timestamp_end?: number | null
          video_timestamp_start?: number | null
        }
        Update: {
          created_at?: string
          estimated_minutes?: number | null
          id?: string
          instructions?: string
          plan_id?: string
          proof_instructions?: string
          proof_type?: string
          step_number?: number
          success_criteria?: string
          title?: string
          video_timestamp_end?: number | null
          video_timestamp_start?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plan_steps_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          category: string | null
          complexity: string | null
          content_analysis: Json | null
          content_item_id: string | null
          created_at: string
          created_by: string
          current_version: Json
          id: string
          is_template: boolean
          org_id: string
          original_ai_draft: Json | null
          quality_scores: Json | null
          skill_level: string | null
          target_role: string | null
          title: string
        }
        Insert: {
          category?: string | null
          complexity?: string | null
          content_analysis?: Json | null
          content_item_id?: string | null
          created_at?: string
          created_by: string
          current_version?: Json
          id?: string
          is_template?: boolean
          org_id: string
          original_ai_draft?: Json | null
          quality_scores?: Json | null
          skill_level?: string | null
          target_role?: string | null
          title: string
        }
        Update: {
          category?: string | null
          complexity?: string | null
          content_analysis?: Json | null
          content_item_id?: string | null
          created_at?: string
          created_by?: string
          current_version?: Json
          id?: string
          is_template?: boolean
          org_id?: string
          original_ai_draft?: Json | null
          quality_scores?: Json | null
          skill_level?: string | null
          target_role?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_content_item_id_fkey"
            columns: ["content_item_id"]
            isOneToOne: false
            referencedRelation: "content_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plans_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      slack_installations: {
        Row: {
          bot_token_encrypted: string
          bot_user_id: string | null
          created_at: string
          id: string
          installed_by: string | null
          org_id: string
          scopes: string[]
          team_id: string
        }
        Insert: {
          bot_token_encrypted: string
          bot_user_id?: string | null
          created_at?: string
          id?: string
          installed_by?: string | null
          org_id: string
          scopes?: string[]
          team_id: string
        }
        Update: {
          bot_token_encrypted?: string
          bot_user_id?: string | null
          created_at?: string
          id?: string
          installed_by?: string | null
          org_id?: string
          scopes?: string[]
          team_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "slack_installations_installed_by_fkey"
            columns: ["installed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slack_installations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      step_completions: {
        Row: {
          assignment_id: string
          completed_at: string
          difficulty_rating: number | null
          evidence: Json
          id: string
          note: string | null
          platform_completed_on: string | null
          step_number: number
        }
        Insert: {
          assignment_id: string
          completed_at?: string
          difficulty_rating?: number | null
          evidence?: Json
          id?: string
          note?: string | null
          platform_completed_on?: string | null
          step_number: number
        }
        Update: {
          assignment_id?: string
          completed_at?: string
          difficulty_rating?: number | null
          evidence?: Json
          id?: string
          note?: string | null
          platform_completed_on?: string | null
          step_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "step_completions_assignment_id_fkey"
            columns: ["assignment_id"]
            isOneToOne: false
            referencedRelation: "assignments"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          org_id: string
          plan_tier: string
          seat_count: number
          seat_limit: number
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          trial_ends_at: string | null
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          org_id: string
          plan_tier?: string
          seat_count?: number
          seat_limit?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          org_id?: string
          plan_tier?: string
          seat_count?: number
          seat_limit?: number
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          trial_ends_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      teams_installations: {
        Row: {
          bot_id: string
          bot_password_encrypted: string
          created_at: string
          id: string
          installed_by: string | null
          org_id: string
          service_url: string | null
          tenant_id: string
        }
        Insert: {
          bot_id: string
          bot_password_encrypted: string
          created_at?: string
          id?: string
          installed_by?: string | null
          org_id: string
          service_url?: string | null
          tenant_id: string
        }
        Update: {
          bot_id?: string
          bot_password_encrypted?: string
          created_at?: string
          id?: string
          installed_by?: string | null
          org_id?: string
          service_url?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_installations_installed_by_fkey"
            columns: ["installed_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_installations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          notification_preferences: Json
          org_id: string
          role: string
          slack_user_id: string | null
          teams_user_id: string | null
          title: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          notification_preferences?: Json
          org_id: string
          role?: string
          slack_user_id?: string | null
          teams_user_id?: string | null
          title?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          notification_preferences?: Json
          org_id?: string
          role?: string
          slack_user_id?: string | null
          teams_user_id?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organisations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      auth_user_org_id: { Args: never; Returns: string }
      create_organisation_for_signup: {
        Args: { org_name: string }
        Returns: string
      }
      match_content_chunks: {
        Args: {
          p_match_count?: number
          p_org_id: string
          p_query_embedding: string
        }
        Returns: {
          chunk_index: number
          chunk_text: string
          content_item_id: string
          similarity: number
        }[]
      }
      match_plan_embeddings: {
        Args: {
          p_match_count?: number
          p_org_id: string
          p_query_embedding: string
        }
        Returns: {
          plan_id: string
          plan_text: string
          similarity: number
        }[]
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
