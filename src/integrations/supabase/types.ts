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
          referral: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          referral?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          referral?: string | null
        }
        Relationships: []
      }
      ai_settings: {
        Row: {
          default_email_limit: number
          default_linkedin_limit: number
          id: boolean
          updated_at: string
        }
        Insert: {
          default_email_limit?: number
          default_linkedin_limit?: number
          id?: boolean
          updated_at?: string
        }
        Update: {
          default_email_limit?: number
          default_linkedin_limit?: number
          id?: boolean
          updated_at?: string
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
          variant_template_id: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          delay_days?: number
          id?: string
          step_order?: number
          template_id: string
          variant_template_id?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          delay_days?: number
          id?: string
          step_order?: number
          template_id?: string
          variant_template_id?: string | null
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
          breakup_day_exclusive: boolean
          completed_at: string | null
          config_id: string | null
          created_at: string
          id: string
          include_unsubscribe: boolean
          list_id: string
          name: string
          prioritize_followups: boolean
          recipient_timezone: boolean
          rotation_config_ids: string[]
          send_days: number[]
          send_window_end: string | null
          send_window_start: string | null
          started_at: string | null
          status: string
          timezone: string
          user_id: string
        }
        Insert: {
          breakup_day_exclusive?: boolean
          completed_at?: string | null
          config_id?: string | null
          created_at?: string
          id?: string
          include_unsubscribe?: boolean
          list_id: string
          name: string
          prioritize_followups?: boolean
          recipient_timezone?: boolean
          rotation_config_ids?: string[]
          send_days?: number[]
          send_window_end?: string | null
          send_window_start?: string | null
          started_at?: string | null
          status?: string
          timezone?: string
          user_id: string
        }
        Update: {
          breakup_day_exclusive?: boolean
          completed_at?: string | null
          config_id?: string | null
          created_at?: string
          id?: string
          include_unsubscribe?: boolean
          list_id?: string
          name?: string
          prioritize_followups?: boolean
          recipient_timezone?: boolean
          rotation_config_ids?: string[]
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
          email_check_reason: string | null
          email_checked_at: string | null
          email_status: string | null
          enriched_at: string | null
          first_name: string
          id: string
          last_name: string
          linkedin_url: string
          list_id: string
          organization_id: string | null
          phone: string
          title: string
          unsubscribed: boolean
          user_id: string
        }
        Insert: {
          company?: string
          created_at?: string
          custom_fields?: Json
          email: string
          email_check_reason?: string | null
          email_checked_at?: string | null
          email_status?: string | null
          enriched_at?: string | null
          first_name?: string
          id?: string
          last_name?: string
          linkedin_url?: string
          list_id: string
          organization_id?: string | null
          phone?: string
          title?: string
          unsubscribed?: boolean
          user_id: string
        }
        Update: {
          company?: string
          created_at?: string
          custom_fields?: Json
          email?: string
          email_check_reason?: string | null
          email_checked_at?: string | null
          email_status?: string | null
          enriched_at?: string | null
          first_name?: string
          id?: string
          last_name?: string
          linkedin_url?: string
          list_id?: string
          organization_id?: string | null
          phone?: string
          title?: string
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
          {
            foreignKeyName: "contacts_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_activities: {
        Row: {
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          done: boolean
          id: string
          lead_id: string | null
          location: string | null
          schedule_from: string | null
          schedule_to: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          done?: boolean
          id?: string
          lead_id?: string | null
          location?: string | null
          schedule_from?: string | null
          schedule_to?: string | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          done?: boolean
          id?: string
          lead_id?: string | null
          location?: string | null
          schedule_from?: string | null
          schedule_to?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_products: {
        Row: {
          amount: number
          created_at: string
          deal_id: string
          id: string
          product_id: string
          quantity: number
          unit_price: number
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          deal_id: string
          id?: string
          product_id: string
          quantity?: number
          unit_price?: number
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          deal_id?: string
          id?: string
          product_id?: string
          quantity?: number
          unit_price?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_products_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_products"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deals: {
        Row: {
          contact_id: string
          created_at: string
          currency: string
          expected_close: string | null
          id: string
          lost_reason: string | null
          position: number
          priority: string | null
          source: string | null
          stage_id: string
          territory: string | null
          title: string
          updated_at: string
          user_id: string
          value: number
          won_reason: string | null
        }
        Insert: {
          contact_id: string
          created_at?: string
          currency?: string
          expected_close?: string | null
          id?: string
          lost_reason?: string | null
          position?: number
          priority?: string | null
          source?: string | null
          stage_id: string
          territory?: string | null
          title?: string
          updated_at?: string
          user_id: string
          value?: number
          won_reason?: string | null
        }
        Update: {
          contact_id?: string
          created_at?: string
          currency?: string
          expected_close?: string | null
          id?: string
          lost_reason?: string | null
          position?: number
          priority?: string | null
          source?: string | null
          stage_id?: string
          territory?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          value?: number
          won_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deals_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          company: string | null
          contact_id: string | null
          created_at: string
          currency: string
          deal_id: string | null
          description: string | null
          email: string | null
          expected_close: string | null
          first_name: string | null
          id: string
          last_name: string | null
          lead_value: number
          lost_reason: string | null
          phone: string | null
          source: string | null
          stage_id: string | null
          status: string
          title: string
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          description?: string | null
          email?: string | null
          expected_close?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lead_value?: number
          lost_reason?: string | null
          phone?: string | null
          source?: string | null
          stage_id?: string | null
          status?: string
          title: string
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          description?: string | null
          email?: string | null
          expected_close?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lead_value?: number
          lost_reason?: string | null
          phone?: string | null
          source?: string | null
          stage_id?: string | null
          status?: string
          title?: string
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_notes: {
        Row: {
          body: string
          contact_id: string
          created_at: string
          deal_id: string | null
          done: boolean
          id: string
          remind_at: string | null
          user_id: string
        }
        Insert: {
          body: string
          contact_id: string
          created_at?: string
          deal_id?: string | null
          done?: boolean
          id?: string
          remind_at?: string | null
          user_id: string
        }
        Update: {
          body?: string
          contact_id?: string
          created_at?: string
          deal_id?: string | null
          done?: boolean
          id?: string
          remind_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_notes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_notes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_organizations: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          description: string | null
          domain: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          domain?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          domain?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_products: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          description: string | null
          id: string
          name: string
          price: number
          sku: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name: string
          price?: number
          sku?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name?: string
          price?: number
          sku?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_quote_items: {
        Row: {
          description: string | null
          id: string
          name: string
          price: number
          product_id: string | null
          quantity: number
          quote_id: string
          total: number
        }
        Insert: {
          description?: string | null
          id?: string
          name: string
          price?: number
          product_id?: string | null
          quantity?: number
          quote_id: string
          total?: number
        }
        Update: {
          description?: string | null
          id?: string
          name?: string
          price?: number
          product_id?: string | null
          quantity?: number
          quote_id?: string
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "crm_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_quotes: {
        Row: {
          adjustment: number
          billing_address: string | null
          contact_id: string | null
          created_at: string
          currency: string
          deal_id: string | null
          description: string | null
          discount_percent: number
          expired_at: string | null
          grand_total: number
          id: string
          organization_id: string | null
          quote_number: string | null
          shipping_address: string | null
          status: string
          subject: string
          subtotal: number
          tax_percent: number
          terms: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          adjustment?: number
          billing_address?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          description?: string | null
          discount_percent?: number
          expired_at?: string | null
          grand_total?: number
          id?: string
          organization_id?: string | null
          quote_number?: string | null
          shipping_address?: string | null
          status?: string
          subject: string
          subtotal?: number
          tax_percent?: number
          terms?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          adjustment?: number
          billing_address?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          description?: string | null
          discount_percent?: number
          expired_at?: string | null
          grand_total?: number
          id?: string
          organization_id?: string | null
          quote_number?: string | null
          shipping_address?: string | null
          status?: string
          subject?: string
          subtotal?: number
          tax_percent?: number
          terms?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_quotes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_quotes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "crm_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_stages: {
        Row: {
          color: string
          created_at: string
          id: string
          is_lost: boolean
          is_won: boolean
          name: string
          position: number
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name: string
          position?: number
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_lost?: boolean
          is_won?: boolean
          name?: string
          position?: number
          user_id?: string
        }
        Relationships: []
      }
      crm_activities: {
        Row: {
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          done: boolean
          id: string
          lead_id: string | null
          location: string | null
          schedule_from: string | null
          schedule_to: string | null
          title: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          done?: boolean
          id?: string
          lead_id?: string | null
          location?: string | null
          schedule_from?: string | null
          schedule_to?: string | null
          title: string
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          done?: boolean
          id?: string
          lead_id?: string | null
          location?: string | null
          schedule_from?: string | null
          schedule_to?: string | null
          title?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_activities_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_deal_products: {
        Row: {
          created_at: string
          deal_id: string
          discount_pct: number
          id: string
          name: string
          product_id: string | null
          qty: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          deal_id: string
          discount_pct?: number
          id?: string
          name: string
          product_id?: string | null
          qty?: number
          unit_price?: number
        }
        Update: {
          created_at?: string
          deal_id?: string
          discount_pct?: number
          id?: string
          name?: string
          product_id?: string | null
          qty?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_deal_products_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_deal_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_products"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          company: string | null
          contact_id: string | null
          created_at: string
          currency: string
          deal_id: string | null
          description: string | null
          email: string | null
          expected_close: string | null
          first_name: string | null
          id: string
          last_name: string | null
          lead_value: number
          lost_reason: string | null
          phone: string | null
          source: string | null
          stage_id: string | null
          status: string
          title: string
          type: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          company?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          description?: string | null
          email?: string | null
          expected_close?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lead_value?: number
          lost_reason?: string | null
          phone?: string | null
          source?: string | null
          stage_id?: string | null
          status?: string
          title: string
          type?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          company?: string | null
          contact_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          description?: string | null
          email?: string | null
          expected_close?: string | null
          first_name?: string | null
          id?: string
          last_name?: string | null
          lead_value?: number
          lost_reason?: string | null
          phone?: string | null
          source?: string | null
          stage_id?: string | null
          status?: string
          title?: string
          type?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_leads_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "crm_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_organizations: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string
          description: string | null
          employee_count: number | null
          id: string
          industry: string | null
          name: string
          phone: string | null
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          employee_count?: number | null
          id?: string
          industry?: string | null
          name: string
          phone?: string | null
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string
          description?: string | null
          employee_count?: number | null
          id?: string
          industry?: string | null
          name?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      crm_products: {
        Row: {
          created_at: string
          currency: string
          description: string | null
          id: string
          name: string
          price: number
          sku: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name: string
          price?: number
          sku?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          description?: string | null
          id?: string
          name?: string
          price?: number
          sku?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_quote_items: {
        Row: {
          created_at: string
          description: string | null
          discount_pct: number
          id: string
          name: string
          position: number
          product_id: string | null
          qty: number
          quote_id: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          name: string
          position?: number
          product_id?: string | null
          qty?: number
          quote_id: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_pct?: number
          id?: string
          name?: string
          position?: number
          product_id?: string | null
          qty?: number
          quote_id?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "crm_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_quotes: {
        Row: {
          contact_id: string | null
          created_at: string
          currency: string
          deal_id: string | null
          id: string
          notes: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
          valid_until: string | null
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          id?: string
          notes?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
          valid_until?: string | null
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          currency?: string
          deal_id?: string | null
          id?: string
          notes?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_quotes_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_quotes_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_call_logs: {
        Row: {
          contact_id: string | null
          created_at: string
          deal_id: string | null
          duration_seconds: number
          id: string
          lead_id: string | null
          phone_number: string | null
          recording_url: string | null
          started_at: string
          status: string
          summary: string | null
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          duration_seconds?: number
          id?: string
          lead_id?: string | null
          phone_number?: string | null
          recording_url?: string | null
          started_at?: string
          status?: string
          summary?: string | null
          type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          duration_seconds?: number
          id?: string
          lead_id?: string | null
          phone_number?: string | null
          recording_url?: string | null
          started_at?: string
          status?: string
          summary?: string | null
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_call_logs_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_call_logs_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_call_logs_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_tasks: {
        Row: {
          completed_at: string | null
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          due_date: string | null
          id: string
          lead_id: string | null
          priority: string
          reminder_at: string | null
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: string
          reminder_at?: string | null
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          lead_id?: string | null
          priority?: string
          reminder_at?: string | null
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "crm_deals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_tasks_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_settings: {
        Row: {
          created_at: string
          default_currency: string
          id: string
          industries: Json
          lead_sources: Json
          lost_reasons: Json
          territories: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_currency?: string
          id?: string
          industries?: Json
          lead_sources?: Json
          lost_reasons?: Json
          territories?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_currency?: string
          id?: string
          industries?: Json
          lead_sources?: Json
          lost_reasons?: Json
          territories?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
          bounced_at: string | null
          campaign_id: string | null
          config_id: string | null
          contact_id: string | null
          created_at: string
          direct_subject: string | null
          direct_to: string | null
          error: string | null
          gmail_message_id: string | null
          gmail_thread_id: string | null
          id: string
          opened_at: string | null
          recipient_email: string | null
          replied_at: string | null
          scheduled_at: string
          sent_at: string | null
          status: string
          step_id: string | null
          user_id: string
          variant: string | null
        }
        Insert: {
          bounced_at?: string | null
          campaign_id?: string | null
          config_id?: string | null
          contact_id?: string | null
          created_at?: string
          direct_subject?: string | null
          direct_to?: string | null
          error?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          opened_at?: string | null
          recipient_email?: string | null
          replied_at?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          step_id?: string | null
          user_id: string
          variant?: string | null
        }
        Update: {
          bounced_at?: string | null
          campaign_id?: string | null
          config_id?: string | null
          contact_id?: string | null
          created_at?: string
          direct_subject?: string | null
          direct_to?: string | null
          error?: string | null
          gmail_message_id?: string | null
          gmail_thread_id?: string | null
          id?: string
          opened_at?: string | null
          recipient_email?: string | null
          replied_at?: string | null
          scheduled_at?: string
          sent_at?: string | null
          status?: string
          step_id?: string | null
          user_id?: string
          variant?: string | null
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
          is_auto_reply: boolean
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
          is_auto_reply?: boolean
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
          is_auto_reply?: boolean
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
      linkedin_cloud_sessions: {
        Row: {
          cookie_enc: string
          cookie_hint: string | null
          proxy_enc: string | null
          status: string
          status_note: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cookie_enc: string
          cookie_hint?: string | null
          proxy_enc?: string | null
          status?: string
          status_note?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cookie_enc?: string
          cookie_hint?: string | null
          proxy_enc?: string | null
          status?: string
          status_note?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      linkedin_runner_tokens: {
        Row: {
          created_at: string
          last_used_at: string | null
          token_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_used_at?: string | null
          token_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_used_at?: string | null
          token_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      linkedin_sequences: {
        Row: {
          created_at: string
          daily_connect_limit: number
          daily_message_limit: number
          id: string
          list_id: string
          mode: string
          name: string
          status: string
          steps: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_connect_limit?: number
          daily_message_limit?: number
          id?: string
          list_id: string
          mode?: string
          name: string
          status?: string
          steps?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          daily_connect_limit?: number
          daily_message_limit?: number
          id?: string
          list_id?: string
          mode?: string
          name?: string
          status?: string
          steps?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_sequences_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_tasks: {
        Row: {
          action: string
          completed_at: string | null
          contact_id: string
          created_at: string
          due_at: string
          id: string
          message: string
          note: string | null
          sequence_id: string
          status: string
          step_index: number
          user_id: string
        }
        Insert: {
          action: string
          completed_at?: string | null
          contact_id: string
          created_at?: string
          due_at?: string
          id?: string
          message?: string
          note?: string | null
          sequence_id: string
          status?: string
          step_index: number
          user_id: string
        }
        Update: {
          action?: string
          completed_at?: string | null
          contact_id?: string
          created_at?: string
          due_at?: string
          id?: string
          message?: string
          note?: string | null
          sequence_id?: string
          status?: string
          step_index?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "linkedin_tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "linkedin_tasks_sequence_id_fkey"
            columns: ["sequence_id"]
            isOneToOne: false
            referencedRelation: "linkedin_sequences"
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
      suppressions: {
        Row: {
          created_at: string
          email: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          reason?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      user_ai_limits: {
        Row: {
          ai_enabled: boolean
          daily_email_limit: number | null
          daily_linkedin_limit: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_enabled?: boolean
          daily_email_limit?: number | null
          daily_linkedin_limit?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_enabled?: boolean
          daily_email_limit?: number | null
          daily_linkedin_limit?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_ai_usage: {
        Row: {
          emails_generated: number
          linkedin_generated: number
          usage_date: string
          user_id: string
        }
        Insert: {
          emails_generated?: number
          linkedin_generated?: number
          usage_date?: string
          user_id: string
        }
        Update: {
          emails_generated?: number
          linkedin_generated?: number
          usage_date?: string
          user_id?: string
        }
        Relationships: []
      }
      user_api_keys: {
        Row: {
          hint: string
          key_ciphertext: string
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          hint?: string
          key_ciphertext: string
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          hint?: string
          key_ciphertext?: string
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
      consume_ai_credit: {
        Args: { _kind: string; _limit: number; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user"
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
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const
