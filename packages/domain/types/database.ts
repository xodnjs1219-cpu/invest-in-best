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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      batch_checkpoints: {
        Row: {
          checkpoint_key: string
          created_at: string
          cursor: Json | null
          id: string
          is_completed: boolean
          job_type: Database["public"]["Enums"]["batch_job_type"]
          updated_at: string
        }
        Insert: {
          checkpoint_key: string
          created_at?: string
          cursor?: Json | null
          id?: string
          is_completed?: boolean
          job_type: Database["public"]["Enums"]["batch_job_type"]
          updated_at?: string
        }
        Update: {
          checkpoint_key?: string
          created_at?: string
          cursor?: Json | null
          id?: string
          is_completed?: boolean
          job_type?: Database["public"]["Enums"]["batch_job_type"]
          updated_at?: string
        }
        Relationships: []
      }
      batch_item_failures: {
        Row: {
          attempt_count: number
          batch_run_id: string
          created_at: string
          id: string
          is_resolved: boolean
          last_error: string | null
          security_id: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          batch_run_id: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          last_error?: string | null
          security_id?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          batch_run_id?: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          last_error?: string | null
          security_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "batch_item_failures_batch_run_id_fkey"
            columns: ["batch_run_id"]
            isOneToOne: false
            referencedRelation: "batch_runs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_item_failures_batch_run_id_fkey"
            columns: ["batch_run_id"]
            isOneToOne: false
            referencedRelation: "batch_runs_summary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batch_item_failures_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      batch_runs: {
        Row: {
          created_at: string
          error_log: string | null
          failed_count: number
          finished_at: string | null
          id: string
          is_carried_over: boolean
          job_type: Database["public"]["Enums"]["batch_job_type"]
          processed_count: number
          started_at: string
          status: Database["public"]["Enums"]["batch_run_status"]
          target_market: Database["public"]["Enums"]["market_code"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          error_log?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          is_carried_over?: boolean
          job_type: Database["public"]["Enums"]["batch_job_type"]
          processed_count?: number
          started_at?: string
          status?: Database["public"]["Enums"]["batch_run_status"]
          target_market?: Database["public"]["Enums"]["market_code"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          error_log?: string | null
          failed_count?: number
          finished_at?: string | null
          id?: string
          is_carried_over?: boolean
          job_type?: Database["public"]["Enums"]["batch_job_type"]
          processed_count?: number
          started_at?: string
          status?: Database["public"]["Enums"]["batch_run_status"]
          target_market?: Database["public"]["Enums"]["market_code"] | null
          updated_at?: string
        }
        Relationships: []
      }
      chain_daily_metrics: {
        Row: {
          based_on_snapshot_id: string | null
          chain_id: string
          covered_node_count: number
          created_at: string
          id: string
          is_carried_forward: boolean
          metric_date: string
          total_market_cap_krw: number | null
          total_node_count: number
          updated_at: string
        }
        Insert: {
          based_on_snapshot_id?: string | null
          chain_id: string
          covered_node_count?: number
          created_at?: string
          id?: string
          is_carried_forward?: boolean
          metric_date: string
          total_market_cap_krw?: number | null
          total_node_count?: number
          updated_at?: string
        }
        Update: {
          based_on_snapshot_id?: string | null
          chain_id?: string
          covered_node_count?: number
          created_at?: string
          id?: string
          is_carried_forward?: boolean
          metric_date?: string
          total_market_cap_krw?: number | null
          total_node_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chain_daily_metrics_based_on_snapshot_id_fkey"
            columns: ["based_on_snapshot_id"]
            isOneToOne: false
            referencedRelation: "chain_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_daily_metrics_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "value_chains"
            referencedColumns: ["id"]
          },
        ]
      }
      chain_quarterly_metrics: {
        Row: {
          based_on_snapshot_id: string | null
          calendar_quarter: number
          calendar_year: number
          chain_id: string
          covered_node_count: number
          created_at: string
          excluded_unmapped_count: number
          id: string
          total_node_count: number
          total_revenue_krw: number | null
          updated_at: string
        }
        Insert: {
          based_on_snapshot_id?: string | null
          calendar_quarter: number
          calendar_year: number
          chain_id: string
          covered_node_count?: number
          created_at?: string
          excluded_unmapped_count?: number
          id?: string
          total_node_count?: number
          total_revenue_krw?: number | null
          updated_at?: string
        }
        Update: {
          based_on_snapshot_id?: string | null
          calendar_quarter?: number
          calendar_year?: number
          chain_id?: string
          covered_node_count?: number
          created_at?: string
          excluded_unmapped_count?: number
          id?: string
          total_node_count?: number
          total_revenue_krw?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chain_quarterly_metrics_based_on_snapshot_id_fkey"
            columns: ["based_on_snapshot_id"]
            isOneToOne: false
            referencedRelation: "chain_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_quarterly_metrics_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "value_chains"
            referencedColumns: ["id"]
          },
        ]
      }
      chain_snapshots: {
        Row: {
          chain_id: string
          change_source: Database["public"]["Enums"]["snapshot_source"]
          created_at: string
          created_by: string | null
          disclosure_date: string | null
          effective_at: string
          id: string
          updated_at: string
        }
        Insert: {
          chain_id: string
          change_source: Database["public"]["Enums"]["snapshot_source"]
          created_at?: string
          created_by?: string | null
          disclosure_date?: string | null
          effective_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          chain_id?: string
          change_source?: Database["public"]["Enums"]["snapshot_source"]
          created_at?: string
          created_by?: string | null
          disclosure_date?: string | null
          effective_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chain_snapshots_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "value_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chain_snapshots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      company_profiles: {
        Row: {
          address: string | null
          created_at: string
          established_date: string | null
          homepage_url: string | null
          industry_code: string | null
          last_collected_at: string | null
          phone: string | null
          representative_name: string | null
          sector: string | null
          security_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          established_date?: string | null
          homepage_url?: string | null
          industry_code?: string | null
          last_collected_at?: string | null
          phone?: string | null
          representative_name?: string | null
          sector?: string | null
          security_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          established_date?: string | null
          homepage_url?: string | null
          industry_code?: string | null
          last_collected_at?: string | null
          phone?: string | null
          representative_name?: string | null
          sector?: string | null
          security_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_profiles_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: true
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_quotes: {
        Row: {
          close_price: number | null
          created_at: string
          high_price: number | null
          id: string
          is_closing_confirmed: boolean
          low_price: number | null
          open_price: number | null
          security_id: string
          source: Database["public"]["Enums"]["data_source"]
          trade_date: string
          updated_at: string
          volume: number | null
        }
        Insert: {
          close_price?: number | null
          created_at?: string
          high_price?: number | null
          id?: string
          is_closing_confirmed?: boolean
          low_price?: number | null
          open_price?: number | null
          security_id: string
          source?: Database["public"]["Enums"]["data_source"]
          trade_date: string
          updated_at?: string
          volume?: number | null
        }
        Update: {
          close_price?: number | null
          created_at?: string
          high_price?: number | null
          id?: string
          is_closing_confirmed?: boolean
          low_price?: number | null
          open_price?: number | null
          security_id?: string
          source?: Database["public"]["Enums"]["data_source"]
          trade_date?: string
          updated_at?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "daily_quotes_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      disclosures: {
        Row: {
          created_at: string
          disclosure_date: string
          external_id: string
          id: string
          llm_analyzed_at: string | null
          security_id: string
          source: Database["public"]["Enums"]["data_source"]
          title: string
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          disclosure_date: string
          external_id: string
          id?: string
          llm_analyzed_at?: string | null
          security_id: string
          source: Database["public"]["Enums"]["data_source"]
          title: string
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          disclosure_date?: string
          external_id?: string
          id?: string
          llm_analyzed_at?: string | null
          security_id?: string
          source?: Database["public"]["Enums"]["data_source"]
          title?: string
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "disclosures_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      fx_rates: {
        Row: {
          base_currency: Database["public"]["Enums"]["currency_code"]
          created_at: string
          id: string
          quote_currency: Database["public"]["Enums"]["currency_code"]
          rate: number
          rate_date: string
          source: Database["public"]["Enums"]["data_source"]
          updated_at: string
        }
        Insert: {
          base_currency: Database["public"]["Enums"]["currency_code"]
          created_at?: string
          id?: string
          quote_currency: Database["public"]["Enums"]["currency_code"]
          rate: number
          rate_date: string
          source?: Database["public"]["Enums"]["data_source"]
          updated_at?: string
        }
        Update: {
          base_currency?: Database["public"]["Enums"]["currency_code"]
          created_at?: string
          id?: string
          quote_currency?: Database["public"]["Enums"]["currency_code"]
          rate?: number
          rate_date?: string
          source?: Database["public"]["Enums"]["data_source"]
          updated_at?: string
        }
        Relationships: []
      }
      llm_relation_proposals: {
        Row: {
          based_on_snapshot_id: string
          chain_id: string
          created_at: string
          disclosure_id: string | null
          id: string
          proposal_type: Database["public"]["Enums"]["llm_proposal_type"]
          rationale: string | null
          relation_type_id: string | null
          resulting_snapshot_id: string | null
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          source_node_id: string
          status: Database["public"]["Enums"]["llm_proposal_status"]
          target_node_id: string
          updated_at: string
        }
        Insert: {
          based_on_snapshot_id: string
          chain_id: string
          created_at?: string
          disclosure_id?: string | null
          id?: string
          proposal_type: Database["public"]["Enums"]["llm_proposal_type"]
          rationale?: string | null
          relation_type_id?: string | null
          resulting_snapshot_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_node_id: string
          status?: Database["public"]["Enums"]["llm_proposal_status"]
          target_node_id: string
          updated_at?: string
        }
        Update: {
          based_on_snapshot_id?: string
          chain_id?: string
          created_at?: string
          disclosure_id?: string | null
          id?: string
          proposal_type?: Database["public"]["Enums"]["llm_proposal_type"]
          rationale?: string | null
          relation_type_id?: string | null
          resulting_snapshot_id?: string | null
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          source_node_id?: string
          status?: Database["public"]["Enums"]["llm_proposal_status"]
          target_node_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "llm_relation_proposals_based_on_snapshot_id_fkey"
            columns: ["based_on_snapshot_id"]
            isOneToOne: false
            referencedRelation: "chain_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_relation_proposals_chain_id_fkey"
            columns: ["chain_id"]
            isOneToOne: false
            referencedRelation: "value_chains"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_relation_proposals_disclosure_id_fkey"
            columns: ["disclosure_id"]
            isOneToOne: false
            referencedRelation: "disclosures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_relation_proposals_relation_type_id_fkey"
            columns: ["relation_type_id"]
            isOneToOne: false
            referencedRelation: "relation_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_relation_proposals_resulting_snapshot_id_fkey"
            columns: ["resulting_snapshot_id"]
            isOneToOne: false
            referencedRelation: "chain_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_relation_proposals_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_relation_proposals_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "snapshot_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "llm_relation_proposals_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "snapshot_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      market_calendar: {
        Row: {
          calendar_date: string
          close_at: string | null
          created_at: string
          id: string
          is_early_close: boolean
          is_trading_day: boolean
          market: Database["public"]["Enums"]["market_code"]
          open_at: string | null
          source: Database["public"]["Enums"]["data_source"]
          updated_at: string
        }
        Insert: {
          calendar_date: string
          close_at?: string | null
          created_at?: string
          id?: string
          is_early_close?: boolean
          is_trading_day?: boolean
          market: Database["public"]["Enums"]["market_code"]
          open_at?: string | null
          source?: Database["public"]["Enums"]["data_source"]
          updated_at?: string
        }
        Update: {
          calendar_date?: string
          close_at?: string | null
          created_at?: string
          id?: string
          is_early_close?: boolean
          is_trading_day?: boolean
          market?: Database["public"]["Enums"]["market_code"]
          open_at?: string | null
          source?: Database["public"]["Enums"]["data_source"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
        }
        Relationships: []
      }
      quarterly_financials: {
        Row: {
          amount_basis: Database["public"]["Enums"]["fin_period_basis"] | null
          calendar_quarter: number | null
          calendar_year: number | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          disclosure_rcept_no: string | null
          fiscal_quarter: number | null
          fiscal_year: number
          id: string
          is_revenue_tag_unmapped: boolean
          net_income: number | null
          operating_income: number | null
          period_end_date: string | null
          period_start_date: string | null
          period_type: Database["public"]["Enums"]["fin_report_period"]
          revenue: number | null
          revenue_source_tag: string | null
          security_id: string
          source: Database["public"]["Enums"]["data_source"]
          updated_at: string
        }
        Insert: {
          amount_basis?: Database["public"]["Enums"]["fin_period_basis"] | null
          calendar_quarter?: number | null
          calendar_year?: number | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          disclosure_rcept_no?: string | null
          fiscal_quarter?: number | null
          fiscal_year: number
          id?: string
          is_revenue_tag_unmapped?: boolean
          net_income?: number | null
          operating_income?: number | null
          period_end_date?: string | null
          period_start_date?: string | null
          period_type: Database["public"]["Enums"]["fin_report_period"]
          revenue?: number | null
          revenue_source_tag?: string | null
          security_id: string
          source: Database["public"]["Enums"]["data_source"]
          updated_at?: string
        }
        Update: {
          amount_basis?: Database["public"]["Enums"]["fin_period_basis"] | null
          calendar_quarter?: number | null
          calendar_year?: number | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          disclosure_rcept_no?: string | null
          fiscal_quarter?: number | null
          fiscal_year?: number
          id?: string
          is_revenue_tag_unmapped?: boolean
          net_income?: number | null
          operating_income?: number | null
          period_end_date?: string | null
          period_start_date?: string | null
          period_type?: Database["public"]["Enums"]["fin_report_period"]
          revenue?: number | null
          revenue_source_tag?: string | null
          security_id?: string
          source?: Database["public"]["Enums"]["data_source"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quarterly_financials_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_ticks: {
        Row: {
          created_at: string
          id: string
          observed_at: string
          price: number
          security_id: string
          source: Database["public"]["Enums"]["data_source"]
          updated_at: string
          volume: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          observed_at: string
          price: number
          security_id: string
          source?: Database["public"]["Enums"]["data_source"]
          updated_at?: string
          volume?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          observed_at?: string
          price?: number
          security_id?: string
          source?: Database["public"]["Enums"]["data_source"]
          updated_at?: string
          volume?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_ticks_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      relation_types: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          is_directed: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_directed?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          is_directed?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      securities: {
        Row: {
          cik: string | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_code"]
          dart_corp_code: string | null
          delist_date: string | null
          english_name: string | null
          id: string
          isin_code: string | null
          list_date: string | null
          listing_status: Database["public"]["Enums"]["listing_status"]
          market: Database["public"]["Enums"]["market_code"]
          name: string
          security_type: string | null
          shares_manual_override_needed: boolean
          ticker: string
          toss_symbol: string | null
          updated_at: string
        }
        Insert: {
          cik?: string | null
          created_at?: string
          currency: Database["public"]["Enums"]["currency_code"]
          dart_corp_code?: string | null
          delist_date?: string | null
          english_name?: string | null
          id?: string
          isin_code?: string | null
          list_date?: string | null
          listing_status?: Database["public"]["Enums"]["listing_status"]
          market: Database["public"]["Enums"]["market_code"]
          name: string
          security_type?: string | null
          shares_manual_override_needed?: boolean
          ticker: string
          toss_symbol?: string | null
          updated_at?: string
        }
        Update: {
          cik?: string | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_code"]
          dart_corp_code?: string | null
          delist_date?: string | null
          english_name?: string | null
          id?: string
          isin_code?: string | null
          list_date?: string | null
          listing_status?: Database["public"]["Enums"]["listing_status"]
          market?: Database["public"]["Enums"]["market_code"]
          name?: string
          security_type?: string | null
          shares_manual_override_needed?: boolean
          ticker?: string
          toss_symbol?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      shares_outstanding: {
        Row: {
          as_of_date: string
          created_at: string
          id: string
          is_multi_class_partial: boolean
          security_id: string
          shares: number
          source: Database["public"]["Enums"]["data_source"]
          source_tag: string | null
          updated_at: string
        }
        Insert: {
          as_of_date: string
          created_at?: string
          id?: string
          is_multi_class_partial?: boolean
          security_id: string
          shares: number
          source: Database["public"]["Enums"]["data_source"]
          source_tag?: string | null
          updated_at?: string
        }
        Update: {
          as_of_date?: string
          created_at?: string
          id?: string
          is_multi_class_partial?: boolean
          security_id?: string
          shares?: number
          source?: Database["public"]["Enums"]["data_source"]
          source_tag?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shares_outstanding_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
        ]
      }
      snapshot_edges: {
        Row: {
          created_at: string
          id: string
          relation_type_id: string
          snapshot_id: string
          source_node_id: string
          target_node_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          relation_type_id: string
          snapshot_id: string
          source_node_id: string
          target_node_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          relation_type_id?: string
          snapshot_id?: string
          source_node_id?: string
          target_node_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_snapshot_edges_source"
            columns: ["source_node_id", "snapshot_id"]
            isOneToOne: false
            referencedRelation: "snapshot_nodes"
            referencedColumns: ["id", "snapshot_id"]
          },
          {
            foreignKeyName: "fk_snapshot_edges_target"
            columns: ["target_node_id", "snapshot_id"]
            isOneToOne: false
            referencedRelation: "snapshot_nodes"
            referencedColumns: ["id", "snapshot_id"]
          },
          {
            foreignKeyName: "snapshot_edges_relation_type_id_fkey"
            columns: ["relation_type_id"]
            isOneToOne: false
            referencedRelation: "relation_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snapshot_edges_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "chain_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      snapshot_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          snapshot_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          snapshot_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          snapshot_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "snapshot_groups_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "chain_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      snapshot_nodes: {
        Row: {
          created_at: string
          group_id: string | null
          id: string
          node_kind: Database["public"]["Enums"]["node_kind"]
          position_x: number | null
          position_y: number | null
          security_id: string | null
          snapshot_id: string
          subject_memo: string | null
          subject_name: string | null
          subject_type: Database["public"]["Enums"]["subject_type"] | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          group_id?: string | null
          id?: string
          node_kind: Database["public"]["Enums"]["node_kind"]
          position_x?: number | null
          position_y?: number | null
          security_id?: string | null
          snapshot_id: string
          subject_memo?: string | null
          subject_name?: string | null
          subject_type?: Database["public"]["Enums"]["subject_type"] | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          group_id?: string | null
          id?: string
          node_kind?: Database["public"]["Enums"]["node_kind"]
          position_x?: number | null
          position_y?: number | null
          security_id?: string | null
          snapshot_id?: string
          subject_memo?: string | null
          subject_name?: string | null
          subject_type?: Database["public"]["Enums"]["subject_type"] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_snapshot_nodes_group"
            columns: ["group_id", "snapshot_id"]
            isOneToOne: false
            referencedRelation: "snapshot_groups"
            referencedColumns: ["id", "snapshot_id"]
          },
          {
            foreignKeyName: "snapshot_nodes_security_id_fkey"
            columns: ["security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "snapshot_nodes_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "chain_snapshots"
            referencedColumns: ["id"]
          },
        ]
      }
      terms_agreements: {
        Row: {
          agreed_at: string
          created_at: string
          doc_type: Database["public"]["Enums"]["terms_doc_type"]
          doc_version: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          agreed_at?: string
          created_at?: string
          doc_type: Database["public"]["Enums"]["terms_doc_type"]
          doc_version: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          agreed_at?: string
          created_at?: string
          doc_type?: Database["public"]["Enums"]["terms_doc_type"]
          doc_version?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "terms_agreements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      value_chains: {
        Row: {
          chain_type: Database["public"]["Enums"]["chain_type"]
          created_at: string
          focus_security_id: string | null
          focus_type: Database["public"]["Enums"]["chain_focus_type"]
          id: string
          is_archived: boolean
          name: string
          owner_id: string | null
          source_chain_id: string | null
          source_copied_at: string | null
          updated_at: string
        }
        Insert: {
          chain_type: Database["public"]["Enums"]["chain_type"]
          created_at?: string
          focus_security_id?: string | null
          focus_type: Database["public"]["Enums"]["chain_focus_type"]
          id?: string
          is_archived?: boolean
          name: string
          owner_id?: string | null
          source_chain_id?: string | null
          source_copied_at?: string | null
          updated_at?: string
        }
        Update: {
          chain_type?: Database["public"]["Enums"]["chain_type"]
          created_at?: string
          focus_security_id?: string | null
          focus_type?: Database["public"]["Enums"]["chain_focus_type"]
          id?: string
          is_archived?: boolean
          name?: string
          owner_id?: string | null
          source_chain_id?: string | null
          source_copied_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "value_chains_focus_security_id_fkey"
            columns: ["focus_security_id"]
            isOneToOne: false
            referencedRelation: "securities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "value_chains_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "value_chains_source_chain_id_fkey"
            columns: ["source_chain_id"]
            isOneToOne: false
            referencedRelation: "value_chains"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      batch_runs_summary: {
        Row: {
          created_at: string | null
          failed_count: number | null
          finished_at: string | null
          has_error_log: boolean | null
          id: string | null
          is_carried_over: boolean | null
          job_type: Database["public"]["Enums"]["batch_job_type"] | null
          processed_count: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["batch_run_status"] | null
          target_market: Database["public"]["Enums"]["market_code"] | null
        }
        Insert: {
          created_at?: string | null
          failed_count?: number | null
          finished_at?: string | null
          has_error_log?: never
          id?: string | null
          is_carried_over?: boolean | null
          job_type?: Database["public"]["Enums"]["batch_job_type"] | null
          processed_count?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["batch_run_status"] | null
          target_market?: Database["public"]["Enums"]["market_code"] | null
        }
        Update: {
          created_at?: string | null
          failed_count?: number | null
          finished_at?: string | null
          has_error_log?: never
          id?: string | null
          is_carried_over?: boolean | null
          job_type?: Database["public"]["Enums"]["batch_job_type"] | null
          processed_count?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["batch_run_status"] | null
          target_market?: Database["public"]["Enums"]["market_code"] | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_list_official_chains: {
        Args: never
        Returns: {
          chain_id: string
          created_at: string
          focus_security_id: string
          focus_type: Database["public"]["Enums"]["chain_focus_type"]
          is_archived: boolean
          latest_change_source: Database["public"]["Enums"]["snapshot_source"]
          latest_effective_at: string
          latest_snapshot_id: string
          name: string
          node_count: number
          updated_at: string
        }[]
      }
      admin_list_relation_types: {
        Args: never
        Returns: {
          created_at: string
          id: string
          is_active: boolean
          is_directed: boolean
          is_in_use: boolean
          name: string
          updated_at: string
        }[]
      }
      approve_llm_proposal: {
        Args: { p_proposal_id: string; p_reviewer_id: string }
        Returns: {
          conflict_reason: string
          effective_at: string
          outcome: string
          resulting_snapshot_id: string
        }[]
      }
      clone_value_chain: {
        Args: {
          p_name: string
          p_owner_id: string
          p_source_chain_id: string
          p_source_snapshot_id: string
        }
        Returns: {
          chain_id: string
          cloned_at: string
          edge_count: number
          group_count: number
          node_count: number
          snapshot_id: string
        }[]
      }
      fn_chain_daily_annotations: {
        Args: { p_as_of: string; p_chain_id: string; p_metric_date: string }
        Returns: {
          all_closing_confirmed: boolean
          shares_as_of_max: string
          shares_as_of_min: string
        }[]
      }
      fn_chain_snapshot_at: {
        Args: { p_as_of: string; p_chain_id: string }
        Returns: Json
      }
      fn_latest_daily_closes_before: {
        Args: { p_before: string; p_security_ids: string[] }
        Returns: {
          close_price: number
          security_id: string
          trade_date: string
        }[]
      }
      fn_latest_shares_outstanding: {
        Args: { p_security_ids: string[] }
        Returns: {
          as_of_date: string
          security_id: string
          shares: number
          source: Database["public"]["Enums"]["data_source"]
        }[]
      }
      fn_security_belonging_chains: {
        Args: { p_owner_id?: string; p_security_id: string }
        Returns: {
          chain_id: string
          chain_type: Database["public"]["Enums"]["chain_type"]
          covered_node_count: number
          focus_type: Database["public"]["Enums"]["chain_focus_type"]
          metric_date: string
          name: string
          node_count: number
          total_market_cap_krw: string
          total_node_count: number
        }[]
      }
      fn_upsert_provisional_daily_quotes: {
        Args: {
          p_from: string
          p_market: Database["public"]["Enums"]["market_code"]
          p_to: string
          p_trade_date: string
        }
        Returns: number
      }
      fn_upsert_quarterly_financials: {
        Args: { p_rows: Json }
        Returns: number
      }
      list_chain_cards: {
        Args: {
          p_chain_type: Database["public"]["Enums"]["chain_type"]
          p_limit: number
          p_offset: number
          p_owner_id: string
        }
        Returns: {
          chain_type: Database["public"]["Enums"]["chain_type"]
          covered_node_count: number
          focus_company_name: string
          focus_type: Database["public"]["Enums"]["chain_focus_type"]
          id: string
          is_carried_forward: boolean
          metric_date: string
          name: string
          node_count: number
          total_count: number
          total_market_cap_krw: string
          total_node_count: number
          updated_at: string
        }[]
      }
      list_llm_proposals: {
        Args: {
          p_limit: number
          p_offset: number
          p_status: Database["public"]["Enums"]["llm_proposal_status"]
        }
        Returns: {
          applicability_reason: string
          based_on_snapshot_id: string
          chain_id: string
          chain_name: string
          created_at: string
          disclosure_date: string
          disclosure_id: string
          disclosure_source: Database["public"]["Enums"]["data_source"]
          disclosure_title: string
          disclosure_url: string
          is_applicable: boolean
          proposal_id: string
          proposal_type: Database["public"]["Enums"]["llm_proposal_type"]
          rationale: string
          relation_type_id: string
          relation_type_is_active: boolean
          relation_type_name: string
          resulting_snapshot_id: string
          reviewed_at: string
          reviewed_by: string
          source_display_name: string
          source_node_id: string
          source_node_kind: Database["public"]["Enums"]["node_kind"]
          source_ticker: string
          status: Database["public"]["Enums"]["llm_proposal_status"]
          target_display_name: string
          target_node_id: string
          target_node_kind: Database["public"]["Enums"]["node_kind"]
          target_ticker: string
        }[]
      }
      llm_proposal_applicability: {
        Args: { p_proposal_id: string }
        Returns: {
          is_applicable: boolean
          latest_snapshot_id: string
          reason: string
          remapped_source_node_id: string
          remapped_target_node_id: string
          target_edge_id: string
        }[]
      }
      save_official_chain: {
        Args: {
          p_base_snapshot_id: string
          p_chain_id: string
          p_created_by: string
          p_disclosure_date: string
          p_edges: Json
          p_focus_security_id: string
          p_focus_type: Database["public"]["Enums"]["chain_focus_type"]
          p_groups: Json
          p_max_nodes_per_chain: number
          p_name: string
          p_nodes: Json
        }
        Returns: {
          chain_id: string
          edge_count: number
          effective_at: string
          group_count: number
          node_count: number
          outcome: string
          snapshot_id: string
        }[]
      }
      save_user_chain: {
        Args: {
          p_base_snapshot_id: string
          p_chain_id: string
          p_edges: Json
          p_focus_security_id: string
          p_focus_type: Database["public"]["Enums"]["chain_focus_type"]
          p_groups: Json
          p_max_chains_per_user: number
          p_max_nodes_per_chain: number
          p_name: string
          p_nodes: Json
          p_user_id: string
        }
        Returns: {
          chain_id: string
          edge_count: number
          effective_at: string
          group_count: number
          node_count: number
          outcome: string
          snapshot_id: string
        }[]
      }
      search_securities: {
        Args: {
          p_limit: number
          p_market?: Database["public"]["Enums"]["market_code"]
          p_offset: number
          p_query: string
        }
        Returns: {
          english_name: string
          id: string
          listing_status: Database["public"]["Enums"]["listing_status"]
          market: Database["public"]["Enums"]["market_code"]
          name: string
          ticker: string
        }[]
      }
    }
    Enums: {
      batch_job_type:
        | "collect_quotes"
        | "collect_financials"
        | "collect_fx_market_hours"
        | "aggregate_daily_metrics"
        | "analyze_disclosures"
        | "backfill_all"
      batch_run_status: "running" | "success" | "partial_success" | "failed"
      chain_focus_type: "industry" | "company"
      chain_type: "official" | "user"
      currency_code: "KRW" | "USD"
      data_source: "dart" | "sec" | "toss"
      fin_period_basis: "three_month" | "derived_from_cumulative"
      fin_report_period: "quarter" | "annual"
      listing_status: "listed" | "suspended" | "delisted"
      llm_proposal_status: "pending" | "approved" | "rejected" | "invalidated"
      llm_proposal_type: "relation_add" | "relation_update" | "relation_delete"
      market_code: "KRX" | "US"
      node_kind: "listed_company" | "free_subject"
      snapshot_source: "user_save" | "admin_edit" | "llm_approval"
      subject_type: "consumer" | "government" | "private_company" | "other"
      terms_doc_type: "terms_of_service" | "privacy_policy"
      user_role: "user" | "admin"
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
    Enums: {
      batch_job_type: [
        "collect_quotes",
        "collect_financials",
        "collect_fx_market_hours",
        "aggregate_daily_metrics",
        "analyze_disclosures",
        "backfill_all",
      ],
      batch_run_status: ["running", "success", "partial_success", "failed"],
      chain_focus_type: ["industry", "company"],
      chain_type: ["official", "user"],
      currency_code: ["KRW", "USD"],
      data_source: ["dart", "sec", "toss"],
      fin_period_basis: ["three_month", "derived_from_cumulative"],
      fin_report_period: ["quarter", "annual"],
      listing_status: ["listed", "suspended", "delisted"],
      llm_proposal_status: ["pending", "approved", "rejected", "invalidated"],
      llm_proposal_type: ["relation_add", "relation_update", "relation_delete"],
      market_code: ["KRX", "US"],
      node_kind: ["listed_company", "free_subject"],
      snapshot_source: ["user_save", "admin_edit", "llm_approval"],
      subject_type: ["consumer", "government", "private_company", "other"],
      terms_doc_type: ["terms_of_service", "privacy_policy"],
      user_role: ["user", "admin"],
    },
  },
} as const
