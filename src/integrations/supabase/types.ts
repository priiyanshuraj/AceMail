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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      access_requests: {
        Row: {
          created_at: string
          email: string
          id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
        }
        Relationships: []
      }
      app_user_connections: {
        Row: {
          app_user_id: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_user_id?: string | null
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_user_id?: string | null
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      blacklisted_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      campaign_steps: {
        Row: {
          campaign_id: string
          created_at: string
          delay_days: number
          id: string
          step_order: number
          template_id: string
        }
        Insert: {
          campaign_id: string
          created_at?: string
          delay_days?: number
          id?: string
          step_order?: number
          template_id: string
        }
        Update: {
          campaign_id?: string
          created_at?: string
          delay_days?: number
          id?: string
          step_order?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_steps_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_steps_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          completed_at: string | null
          config_id: string | null
          created_at: string
          id: string
          list_id: string
          name: string
          send_days: number[]
          send_window_end: string | null
          send_window_start: string | null
          started_at: string | null
          status: string
          timezone: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          config_id?: string | null
          created_at?: string
          id?: string
          list_id: string
          name: string
          send_days?: number[]
          send_window_end?: string | null
          send_window_start?: string | null
          started_at?: string | null
          status?: string
          timezone?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          config_id?: string | null
          created_at?: string
          id?: string
          list_id?: string
          name?: string
          send_days?: number[]
          send_window_end?: string | null
          send_window_start?: string | null
          started_at?: string | null
          status?: string
          timezone?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "email_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_lists: {
        Row: {
          created_at: string
          description: string
          id: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          company: string
          created_at: string
          custom_fields: Json
          email: string
          first_name: string
          id: string
          last_name: string
          list_id: string
          unsubscribed: boolean
          user_id: string
        }
        Insert: {
          company?: string
          created_at?: string
          custom_fields?: Json
          email: string
          first_name?: string
          id?: string
          last_name?: string
          list_id: string
          unsubscribed?: boolean
          user_id: string
        }
        Update: {
          company?: string
          created_at?: string
          custom_fields?: Json
          email?: string
          first_name?: string
          id?: string
          last_name?: string
          list_id?: string
          unsubscribed?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      email_click_events: {
        Row: {
          clicked_at: string
          id: string
          link_id: string
          log_id: string
          user_id: string
        }
        Insert: {
          clicked_at?: string
          id?: string
          link_id: string
          log_id: string
          user_id: string
        }
        Update: {
          clicked_at?: string
          id?: string
          link_id?: string
          log_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_click_events_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "email_tracking_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_click_events_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      email_configurations: {
        Row: {
          created_at: string
          daily_limit: number
          delay_seconds: number
          from_email: string
          from_name: string
          hourly_limit: number
          id: string
          imap_host: string | null
          imap_port: number | null
          is_default: boolean
          last_synced_at: string | null
          name: string
          provider: string
          smtp_host: string
          smtp_password: string
          smtp_port: number
          smtp_username: string
          status: string
          updated_at: string
          user_id: string
          warmup_enabled: boolean
          warmup_increment: number
          warmup_start_volume: number
          warmup_started_at: string | null
        }
        Insert: {
          created_at?: string
          daily_limit?: number
          delay_seconds?: number
          from_email: string
          from_name?: string
          hourly_limit?: number
          id?: string
          imap_host?: string | null
          imap_port?: number | null
          is_default?: boolean
          last_synced_at?: string | null
          name: string
          provider?: string
          smtp_host?: string
          smtp_password?: string
          smtp_port?: number
          smtp_username?: string
          status?: string
          updated_at?: string
          user_id: string
          warmup_enabled?: boolean
          warmup_increment?: number
          warmup_start_volume?: number
          warmup_started_at?: string | null
        }
        Update: {
          created_at?: string
          daily_limit?: number
          delay_seconds?: number
          from_email?: string
          from_name?: string
          hourly_limit?: number
          id?: string
          imap_host?: string | null
          imap_port?: number | null
          is_default?: boolean
          last_synced_at?: string | null
          name?: string
          provider?: string
          smtp_host?: string
          smtp_password?: string
          smtp_port?: number
          smtp_username?: string
          status?: string
          updated_at?: string
          user_id?: string
          warmup_enabled?: boolean
          warmup_increment?: number
          warmup_start_volume?: number
          warmup_started_at?: string | null
        }
        Relationships: []
      }
      email_logs: {
        Row: {
          campaign_id: string
          contact_id: string
          created_at: string
          error: string | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          opened_at: string | null
          replied_at: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          step_id: string | null
          user_id: string
        }
        Insert: {
          campaign_id: string
          contact_id: string
          created_at?: string
          error?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          opened_at?: string | null
          replied_at?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          step_id?: string | null
          user_id: string
        }
        Update: {
          campaign_id?: string
          contact_id?: string
          created_at?: string
          error?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          opened_at?: string | null
          replied_at?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          step_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "campaign_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          attach_signature: boolean
          body: string
          copy_count: number
          created_at: string
          id: string
          name: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attach_signature?: boolean
          body?: string
          copy_count?: number
          created_at?: string
          id?: string
          name: string
          subject?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attach_signature?: boolean
          body?: string
          copy_count?: number
          created_at?: string
          id?: string
          name?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      email_tracking_links: {
        Row: {
          created_at: string
          destination: string
          id: string
          log_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          destination: string
          id?: string
          log_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          destination?: string
          id?: string
          log_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_tracking_links_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      inbox_messages: {
        Row: {
          campaign_id: string | null
          config_id: string | null
          contact_id: string | null
          from_email: string
          from_name: string
          gmail_message_id: string
          gmail_thread_id: string | null
          id: string
          is_read: boolean
          log_id: string | null
          received_at: string
          snippet: string
          subject: string
          user_id: string
        }
        Insert: {
          campaign_id?: string | null
          config_id?: string | null
          contact_id?: string | null
          from_email?: string
          from_name?: string
          gmail_message_id: string
          gmail_thread_id?: string | null
          id?: string
          is_read?: boolean
          log_id?: string | null
          received_at?: string
          snippet?: string
          subject?: string
          user_id: string
        }
        Update: {
          campaign_id?: string | null
          config_id?: string | null
          contact_id?: string | null
          from_email?: string
          from_name?: string
          gmail_message_id?: string
          gmail_thread_id?: string | null
          id?: string
          is_read?: boolean
          log_id?: string | null
          received_at?: string
          snippet?: string
          subject?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbox_messages_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_messages_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "email_configurations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbox_messages_log_id_fkey"
            columns: ["log_id"]
            isOneToOne: false
            referencedRelation: "email_logs"
            referencedColumns: ["id"]
          },
        ]
      }
      mailbox_credentials: {
        Row: {
          app_user_id: string | null
          config_id: string
          connection_key_ciphertext: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_user_id?: string | null
          config_id: string
          connection_key_ciphertext: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_user_id?: string | null
          config_id?: string
          connection_key_ciphertext?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mailbox_credentials_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: true
            referencedRelation: "email_configurations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_signatures: {
        Row: {
          signature: string
          updated_at: string
          user_id: string
        }
        Insert: {
          signature?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          signature?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      campaign_analytics: { Args: { _campaign_id: string }; Returns: Json }
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
