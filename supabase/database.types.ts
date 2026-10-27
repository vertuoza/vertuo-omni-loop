export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      agent_question_reports: {
        Row: {
          id: number
          question_id: string
          reported_at: string
          token_id: string
        }
        Insert: {
          id?: never
          question_id: string
          reported_at?: string
          token_id: string
        }
        Update: {
          id?: never
          question_id?: string
          reported_at?: string
          token_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_question_reports_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "agent_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_question_reports_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "agent_tokens"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_questions: {
        Row: {
          asked: number
          brought_back_at: string | null
          claim_id: string | null
          closed_at: string | null
          closed_by: string | null
          file: string | null
          first_asked_at: string
          id: string
          last_asked_at: string
          match_key: string
          question: string
          repo: string | null
          set_aside_at: string | null
          state: string
          token_id: string
          workspace_id: string
        }
        Insert: {
          asked?: number
          brought_back_at?: string | null
          claim_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          file?: string | null
          first_asked_at?: string
          id?: string
          last_asked_at?: string
          match_key: string
          question: string
          repo?: string | null
          set_aside_at?: string | null
          state?: string
          token_id: string
          workspace_id: string
        }
        Update: {
          asked?: number
          brought_back_at?: string | null
          claim_id?: string | null
          closed_at?: string | null
          closed_by?: string | null
          file?: string | null
          first_asked_at?: string
          id?: string
          last_asked_at?: string
          match_key?: string
          question?: string
          repo?: string | null
          set_aside_at?: string | null
          state?: string
          token_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_questions_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_questions_token_id_fkey"
            columns: ["token_id"]
            isOneToOne: false
            referencedRelation: "agent_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_questions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_tokens: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          last_four: string
          last_used_at: string | null
          made_by: string
          name: string
          repos: string[]
          revoked_at: string | null
          revoked_by: string | null
          scope: string
          session: string | null
          session_lease: string | null
          session_lease_until: string | null
          token_hash: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_four: string
          last_used_at?: string | null
          made_by: string
          name: string
          repos?: string[]
          revoked_at?: string | null
          revoked_by?: string | null
          scope?: string
          session?: string | null
          session_lease?: string | null
          session_lease_until?: string | null
          token_hash: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          last_four?: string
          last_used_at?: string | null
          made_by?: string
          name?: string
          repos?: string[]
          revoked_at?: string | null
          revoked_by?: string | null
          scope?: string
          session?: string | null
          session_lease?: string | null
          session_lease_until?: string | null
          token_hash?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_tokens_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_channels: {
        Row: {
          email: boolean
          push: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email?: boolean
          push?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email?: boolean
          push?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      api_key_github_apps: {
        Row: {
          app_id: number
          attached_at: string
          attached_by: string | null
          bot_id: number
          ciphertext: string
          iv: string
          key_id: string
          last_token_at: string | null
          slug: string
          workspace_id: string
        }
        Insert: {
          app_id: number
          attached_at?: string
          attached_by?: string | null
          bot_id: number
          ciphertext: string
          iv: string
          key_id: string
          last_token_at?: string | null
          slug: string
          workspace_id: string
        }
        Update: {
          app_id?: number
          attached_at?: string
          attached_by?: string | null
          bot_id?: number
          ciphertext?: string
          iv?: string
          key_id?: string
          last_token_at?: string | null
          slug?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "api_key_github_apps_key_id_fkey"
            columns: ["key_id"]
            isOneToOne: true
            referencedRelation: "agent_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "api_key_github_apps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          asked: string[]
          asked_at: string
          asked_by: string
          dossier_id: string
          id: string
          kind: string
          nobody_else: boolean
          product_id: string | null
          workspace_id: string
        }
        Insert: {
          asked: string[]
          asked_at?: string
          asked_by: string
          dossier_id: string
          id?: string
          kind: string
          nobody_else: boolean
          product_id?: string | null
          workspace_id: string
        }
        Update: {
          asked?: string[]
          asked_at?: string
          asked_by?: string
          dossier_id?: string
          id?: string
          kind?: string
          nobody_else?: boolean
          product_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_voids: {
        Row: {
          approval_id: string
          dossier_id: string
          from_sha256: string
          id: string
          kind: string
          pushed_by: string | null
          pusher_login: string
          to_sha256: string
          version_id: string
          voided_at: string
        }
        Insert: {
          approval_id: string
          dossier_id: string
          from_sha256: string
          id?: string
          kind: string
          pushed_by?: string | null
          pusher_login: string
          to_sha256: string
          version_id: string
          voided_at?: string
        }
        Update: {
          approval_id?: string
          dossier_id?: string
          from_sha256?: string
          id?: string
          kind?: string
          pushed_by?: string | null
          pusher_login?: string
          to_sha256?: string
          version_id?: string
          voided_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_voids_approval_id_fkey"
            columns: ["approval_id"]
            isOneToOne: false
            referencedRelation: "approvals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_voids_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_voids_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "dossier_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      approvals: {
        Row: {
          approved_at: string
          approved_by: string
          approver_login: string
          dossier_id: string
          files: Json
          id: string
        }
        Insert: {
          approved_at?: string
          approved_by: string
          approver_login: string
          dossier_id: string
          files: Json
          id?: string
        }
        Update: {
          approved_at?: string
          approved_by?: string
          approver_login?: string
          dossier_id?: string
          files?: Json
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approvals_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      arcade_scores: {
        Row: {
          at: string
          best: number
          game: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          at?: string
          best: number
          game: string
          user_id: string
          workspace_id: string
        }
        Update: {
          at?: string
          best?: number
          game?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "arcade_scores_workspace_id_user_id_fkey"
            columns: ["workspace_id", "user_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["workspace_id", "user_id"]
          },
        ]
      }
      ask_cli_codes: {
        Row: {
          code_hash: string
          expires_at: string
          owner: string
          refresh_token: string
        }
        Insert: {
          code_hash: string
          expires_at: string
          owner: string
          refresh_token: string
        }
        Update: {
          code_hash?: string
          expires_at?: string
          owner?: string
          refresh_token?: string
        }
        Relationships: []
      }
      ask_cli_devices: {
        Row: {
          days: number | null
          device_hash: string
          expires_at: string
          last_polled_at: string | null
          name: string | null
          payload: string | null
          payload_expires_at: string | null
          poll_interval: number
          purpose: string
          status: string
          user_code: string
          workspace: string | null
        }
        Insert: {
          days?: number | null
          device_hash: string
          expires_at: string
          last_polled_at?: string | null
          name?: string | null
          payload?: string | null
          payload_expires_at?: string | null
          poll_interval?: number
          purpose: string
          status?: string
          user_code: string
          workspace?: string | null
        }
        Update: {
          days?: number | null
          device_hash?: string
          expires_at?: string
          last_polled_at?: string | null
          name?: string | null
          payload?: string | null
          payload_expires_at?: string | null
          poll_interval?: number
          purpose?: string
          status?: string
          user_code?: string
          workspace?: string | null
        }
        Relationships: []
      }
      ask_rounds: {
        Row: {
          answered_at: string | null
          answered_by: string | null
          answered_via: string | null
          answers: Json | null
          attachments: Json | null
          category: string | null
          category_by: string | null
          cost_usd: number | null
          created_at: string
          id: string
          lead: string | null
          model: string | null
          prd: number | null
          questions: Json
          session_id: string
          skill: string | null
          status: string
          tokens: Json | null
        }
        Insert: {
          answered_at?: string | null
          answered_by?: string | null
          answered_via?: string | null
          answers?: Json | null
          attachments?: Json | null
          category?: string | null
          category_by?: string | null
          cost_usd?: number | null
          created_at?: string
          id?: string
          lead?: string | null
          model?: string | null
          prd?: number | null
          questions: Json
          session_id: string
          skill?: string | null
          status?: string
          tokens?: Json | null
        }
        Update: {
          answered_at?: string | null
          answered_by?: string | null
          answered_via?: string | null
          answers?: Json | null
          attachments?: Json | null
          category?: string | null
          category_by?: string | null
          cost_usd?: number | null
          created_at?: string
          id?: string
          lead?: string | null
          model?: string | null
          prd?: number | null
          questions?: Json
          session_id?: string
          skill?: string | null
          status?: string
          tokens?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ask_rounds_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ask_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ask_sessions: {
        Row: {
          branch: string | null
          claude_session_id: string | null
          created_at: string
          id: string
          last_seen_at: string
          owner: string
          repo: string | null
          status: string
          title: string
          workspace_id: string | null
        }
        Insert: {
          branch?: string | null
          claude_session_id?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string
          owner?: string
          repo?: string | null
          status?: string
          title: string
          workspace_id?: string | null
        }
        Update: {
          branch?: string | null
          claude_session_id?: string | null
          created_at?: string
          id?: string
          last_seen_at?: string
          owner?: string
          repo?: string | null
          status?: string
          title?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ask_sessions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      ask_shares: {
        Row: {
          created_at: string
          round_id: string
          shared_by: string
          shared_with: string
        }
        Insert: {
          created_at?: string
          round_id: string
          shared_by: string
          shared_with: string
        }
        Update: {
          created_at?: string
          round_id?: string
          shared_by?: string
          shared_with?: string
        }
        Relationships: [
          {
            foreignKeyName: "ask_shares_round_id_fkey"
            columns: ["round_id"]
            isOneToOne: false
            referencedRelation: "ask_rounds"
            referencedColumns: ["id"]
          },
        ]
      }
      business_drafts: {
        Row: {
          business_id: string
          counts: Json
          finished_at: string | null
          id: string
          kind: string
          reason: string | null
          scanned: Json
          started_at: string
          started_by: string | null
          state: string
          workspace_id: string
        }
        Insert: {
          business_id: string
          counts?: Json
          finished_at?: string | null
          id?: string
          kind: string
          reason?: string | null
          scanned?: Json
          started_at?: string
          started_by?: string | null
          state?: string
          workspace_id: string
        }
        Update: {
          business_id?: string
          counts?: Json
          finished_at?: string | null
          id?: string
          kind?: string
          reason?: string | null
          scanned?: Json
          started_at?: string
          started_by?: string | null
          state?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_drafts_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_drafts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      business_sources: {
        Row: {
          added_at: string
          added_by: string | null
          business_id: string
          id: string
          url: string
          workspace_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          business_id: string
          id?: string
          url: string
          workspace_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          business_id?: string
          id?: string
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_sources_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_sources_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "businesses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_citations: {
        Row: {
          cited_as: string | null
          cited_at: string
          cited_by: string
          claim_id: string
          id: number
          ref: string | null
          workspace_id: string
        }
        Insert: {
          cited_as?: string | null
          cited_at?: string
          cited_by: string
          claim_id: string
          id?: never
          ref?: string | null
          workspace_id: string
        }
        Update: {
          cited_as?: string | null
          cited_at?: string
          cited_by?: string
          claim_id?: string
          id?: never
          ref?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_citations_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_citations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_receipts: {
        Row: {
          claim_id: string
          id: number
          kind: string
          location: string
          quote: string
          seen_at: string
          workspace_id: string
        }
        Insert: {
          claim_id: string
          id?: never
          kind: string
          location: string
          quote: string
          seen_at?: string
          workspace_id: string
        }
        Update: {
          claim_id?: string
          id?: never
          kind?: string
          location?: string
          quote?: string
          seen_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_receipts_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_receipts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          last_seen: string | null
          product_id: string | null
          receipt: string | null
          replaces: string | null
          seq: number
          source: string
          state: string
          updated_at: string
          value: string
          workspace_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          last_seen?: string | null
          product_id?: string | null
          receipt?: string | null
          replaces?: string | null
          seq: number
          source: string
          state: string
          updated_at?: string
          value: string
          workspace_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          last_seen?: string | null
          product_id?: string | null
          receipt?: string | null
          replaces?: string | null
          seq?: number
          source?: string
          state?: string
          updated_at?: string
          value?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_replaces_fkey"
            columns: ["replaces"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      constituent_events: {
        Row: {
          action: string
          after: string | null
          before: string | null
          changed_at: string
          changed_by: string | null
          claim_id: string | null
          constituent_id: string
          id: number
          note: string | null
          product_id: string
          workspace_id: string
        }
        Insert: {
          action: string
          after?: string | null
          before?: string | null
          changed_at?: string
          changed_by?: string | null
          claim_id?: string | null
          constituent_id: string
          id?: never
          note?: string | null
          product_id: string
          workspace_id: string
        }
        Update: {
          action?: string
          after?: string | null
          before?: string | null
          changed_at?: string
          changed_by?: string | null
          claim_id?: string | null
          constituent_id?: string
          id?: never
          note?: string | null
          product_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "constituent_events_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constituent_events_constituent_id_fkey"
            columns: ["constituent_id"]
            isOneToOne: false
            referencedRelation: "constituents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constituent_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constituent_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      constituents: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          product_id: string
          removed_at: string | null
          removed_by: string | null
          seq: number | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          product_id: string
          removed_at?: string | null
          removed_by?: string | null
          seq?: number | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          product_id?: string
          removed_at?: string | null
          removed_by?: string | null
          seq?: number | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "constituents_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "constituents_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      contributions: {
        Row: {
          at: string
          kind: string
          login: string
          number: number
          repo: string
          seen_at: string
          workspace_id: string
        }
        Insert: {
          at: string
          kind: string
          login: string
          number: number
          repo: string
          seen_at?: string
          workspace_id: string
        }
        Update: {
          at?: string
          kind?: string
          login?: string
          number?: number
          repo?: string
          seen_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contributions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dossier_github: {
        Row: {
          dossier_id: string
          read_at: string
          refreshing_until: string | null
          stale_since: string | null
          summary: Json
          workspace_id: string
        }
        Insert: {
          dossier_id: string
          read_at?: string
          refreshing_until?: string | null
          stale_since?: string | null
          summary: Json
          workspace_id: string
        }
        Update: {
          dossier_id?: string
          read_at?: string
          refreshing_until?: string | null
          stale_since?: string | null
          summary?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dossier_github_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: true
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dossier_github_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dossier_versions: {
        Row: {
          bytes: number
          commit_sha: string | null
          content: string
          created_at: string
          dossier_id: string
          git_blob: string | null
          id: string
          kind: string
          sha256: string
          slices: number | null
          source: string
          uploaded_by: string | null
        }
        Insert: {
          bytes: number
          commit_sha?: string | null
          content: string
          created_at?: string
          dossier_id: string
          git_blob?: string | null
          id?: string
          kind: string
          sha256: string
          slices?: number | null
          source: string
          uploaded_by?: string | null
        }
        Update: {
          bytes?: number
          commit_sha?: string | null
          content?: string
          created_at?: string
          dossier_id?: string
          git_blob?: string | null
          id?: string
          kind?: string
          sha256?: string
          slices?: number | null
          source?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dossier_versions_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      dossiers: {
        Row: {
          birthplace: string | null
          claude_session_id: string | null
          created_at: string
          home_repo: string | null
          id: string
          kind: string
          numbered_at: string | null
          opened_by: string | null
          prd: number | null
          product_id: string | null
          product_seq: number | null
          title: string
          workspace_id: string
        }
        Insert: {
          birthplace?: string | null
          claude_session_id?: string | null
          created_at?: string
          home_repo?: string | null
          id?: string
          kind?: string
          numbered_at?: string | null
          opened_by?: string | null
          prd?: number | null
          product_id?: string | null
          product_seq?: number | null
          title: string
          workspace_id: string
        }
        Update: {
          birthplace?: string | null
          claude_session_id?: string | null
          created_at?: string
          home_repo?: string | null
          id?: string
          kind?: string
          numbered_at?: string | null
          opened_by?: string | null
          prd?: number | null
          product_id?: string | null
          product_seq?: number | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dossiers_product_id_workspace_id_fkey"
            columns: ["product_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "dossiers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      fix_facts: {
        Row: {
          dossier_id: string
          facts: Json
          synced_at: string
          workspace_id: string
        }
        Insert: {
          dossier_id: string
          facts: Json
          synced_at?: string
          workspace_id: string
        }
        Update: {
          dossier_id?: string
          facts?: Json
          synced_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fix_facts_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: true
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fix_facts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      fix_rows: {
        Row: {
          changes: string
          closed_at: string | null
          dossier_id: string
          guard: string | null
          id: string
          merged_at: string | null
          position: number
          pull: number | null
          repository: string
          reproduction: string | null
          state: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          changes: string
          closed_at?: string | null
          dossier_id: string
          guard?: string | null
          id?: string
          merged_at?: string | null
          position: number
          pull?: number | null
          repository: string
          reproduction?: string | null
          state?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          changes?: string
          closed_at?: string | null
          dossier_id?: string
          guard?: string | null
          id?: string
          merged_at?: string | null
          position?: number
          pull?: number | null
          repository?: string
          reproduction?: string | null
          state?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fix_rows_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fix_rows_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      fix_unmatched_merges: {
        Row: {
          dossier_id: string
          merged_at: string
          pull: number
          repository: string
          seen_at: string
          workspace_id: string
        }
        Insert: {
          dossier_id: string
          merged_at: string
          pull: number
          repository: string
          seen_at?: string
          workspace_id: string
        }
        Update: {
          dossier_id?: string
          merged_at?: string
          pull?: number
          repository?: string
          seen_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fix_unmatched_merges_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fix_unmatched_merges_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      github_budget: {
        Row: {
          installation_id: number
          limit: number
          paused_until: string | null
          remaining: number
          reset_at: string
          resource: string
          updated_at: string
        }
        Insert: {
          installation_id: number
          limit: number
          paused_until?: string | null
          remaining: number
          reset_at: string
          resource: string
          updated_at?: string
        }
        Update: {
          installation_id?: number
          limit?: number
          paused_until?: string | null
          remaining?: number
          reset_at?: string
          resource?: string
          updated_at?: string
        }
        Relationships: []
      }
      github_etags: {
        Row: {
          body: string
          content_type: string | null
          etag: string
          installation_id: number
          read_at: string
          url: string
        }
        Insert: {
          body: string
          content_type?: string | null
          etag: string
          installation_id: number
          read_at?: string
          url: string
        }
        Update: {
          body?: string
          content_type?: string | null
          etag?: string
          installation_id?: number
          read_at?: string
          url?: string
        }
        Relationships: []
      }
      idea_votes: {
        Row: {
          created_at: string
          idea_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          idea_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          idea_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "idea_votes_idea_id_fkey"
            columns: ["idea_id"]
            isOneToOne: false
            referencedRelation: "ideas"
            referencedColumns: ["id"]
          },
        ]
      }
      ideas: {
        Row: {
          added_by: string | null
          archived: boolean
          created_at: string
          id: string
          lane: string
          pitch: string
          prd: number | null
          product_id: string | null
          repo: string
          title: string
          workspace_id: string
        }
        Insert: {
          added_by?: string | null
          archived?: boolean
          created_at?: string
          id?: string
          lane?: string
          pitch: string
          prd?: number | null
          product_id?: string | null
          repo: string
          title: string
          workspace_id: string
        }
        Update: {
          added_by?: string | null
          archived?: boolean
          created_at?: string
          id?: string
          lane?: string
          pitch?: string
          prd?: number | null
          product_id?: string | null
          repo?: string
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ideas_product_id_workspace_id_fkey"
            columns: ["product_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "ideas_workspace_id_repo_fkey"
            columns: ["workspace_id", "repo"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["workspace_id", "full_name"]
          },
        ]
      }
      jev_calls: {
        Row: {
          called_at: string
          confidence: number | null
          counted: string | null
          decided_by: string
          decision: string
          id: number
          jev_answer: string | null
          mode: string
          model: string | null
          ms: number | null
          old_answer: string | null
          outcome: string
          reason: string | null
          ref: string | null
          workspace_id: string
        }
        Insert: {
          called_at?: string
          confidence?: number | null
          counted?: string | null
          decided_by: string
          decision: string
          id?: never
          jev_answer?: string | null
          mode: string
          model?: string | null
          ms?: number | null
          old_answer?: string | null
          outcome: string
          reason?: string | null
          ref?: string | null
          workspace_id: string
        }
        Update: {
          called_at?: string
          confidence?: number | null
          counted?: string | null
          decided_by?: string
          decision?: string
          id?: never
          jev_answer?: string | null
          mode?: string
          model?: string | null
          ms?: number | null
          old_answer?: string | null
          outcome?: string
          reason?: string | null
          ref?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jev_calls_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      jev_decisions: {
        Row: {
          confidence_floor: number
          decision: string
          mode: string
          threshold: number
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        Insert: {
          confidence_floor?: number
          decision: string
          mode?: string
          threshold?: number
          updated_at?: string
          updated_by?: string | null
          workspace_id: string
        }
        Update: {
          confidence_floor?: number
          decision?: string
          mode?: string
          threshold?: number
          updated_at?: string
          updated_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "jev_decisions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_graphs: {
        Row: {
          graph: Json
          pushed_at: string
          pushed_by: string | null
          pushed_by_login: string | null
          repository: string
          sha: string
        }
        Insert: {
          graph: Json
          pushed_at?: string
          pushed_by?: string | null
          pushed_by_login?: string | null
          repository: string
          sha: string
        }
        Update: {
          graph?: Json
          pushed_at?: string
          pushed_by?: string | null
          pushed_by_login?: string | null
          repository?: string
          sha?: string
        }
        Relationships: []
      }
      knowledge_pack_files: {
        Row: {
          content: string
          pack_id: string
          path: string
          sha256: string
          workspace_id: string
        }
        Insert: {
          content: string
          pack_id: string
          path: string
          sha256: string
          workspace_id: string
        }
        Update: {
          content?: string
          pack_id?: string
          path?: string
          sha256?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_pack_files_pack_id_workspace_id_fkey"
            columns: ["pack_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "knowledge_packs"
            referencedColumns: ["id", "workspace_id"]
          },
        ]
      }
      knowledge_packs: {
        Row: {
          committed_at: string
          id: string
          made_at: string
          newest: boolean
          repository: string
          sha: string
          workspace_id: string
        }
        Insert: {
          committed_at: string
          id?: string
          made_at?: string
          newest?: boolean
          repository: string
          sha: string
          workspace_id: string
        }
        Update: {
          committed_at?: string
          id?: string
          made_at?: string
          newest?: boolean
          repository?: string
          sha?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_packs_workspace_id_repository_fkey"
            columns: ["workspace_id", "repository"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["workspace_id", "full_name"]
          },
        ]
      }
      ledger_events: {
        Row: {
          at: string
          contributor: string | null
          data: Json
          home: string | null
          id: string
          imported_at: string
          planet: number
          region: string | null
          team: string | null
          type: string
          workspace_id: string
        }
        Insert: {
          at: string
          contributor?: string | null
          data?: Json
          home?: string | null
          id: string
          imported_at?: string
          planet: number
          region?: string | null
          team?: string | null
          type: string
          workspace_id: string
        }
        Update: {
          at?: string
          contributor?: string | null
          data?: Json
          home?: string | null
          id?: string
          imported_at?: string
          planet?: number
          region?: string | null
          team?: string | null
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ledger_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      loop_plans: {
        Row: {
          created_at: string
          loop_id: string
          plan: Json
          reason: string
          version: number
        }
        Insert: {
          created_at?: string
          loop_id: string
          plan: Json
          reason: string
          version: number
        }
        Update: {
          created_at?: string
          loop_id?: string
          plan?: Json
          reason?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "loop_plans_loop_id_fkey"
            columns: ["loop_id"]
            isOneToOne: false
            referencedRelation: "loops"
            referencedColumns: ["id"]
          },
        ]
      }
      loop_ticks: {
        Row: {
          action: string
          at: string
          id: number
          items: string[]
          link: string | null
          loop_id: string
          merged: number[]
          next_wake_at: string | null
          prd: number
          repos: string[]
          result: string
          step: number
          steps: number
        }
        Insert: {
          action: string
          at?: string
          id?: never
          items?: string[]
          link?: string | null
          loop_id: string
          merged?: number[]
          next_wake_at?: string | null
          prd: number
          repos?: string[]
          result: string
          step: number
          steps: number
        }
        Update: {
          action?: string
          at?: string
          id?: never
          items?: string[]
          link?: string | null
          loop_id?: string
          merged?: number[]
          next_wake_at?: string | null
          prd?: number
          repos?: string[]
          result?: string
          step?: number
          steps?: number
        }
        Relationships: [
          {
            foreignKeyName: "loop_ticks_loop_id_fkey"
            columns: ["loop_id"]
            isOneToOne: false
            referencedRelation: "loops"
            referencedColumns: ["id"]
          },
        ]
      }
      loops: {
        Row: {
          id: string
          last_tick_at: string | null
          next_wake_at: string | null
          parked: Json
          prds: number[]
          repo: string
          seen_at: string
          started_at: string
          state: string
          stopped_at: string | null
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          last_tick_at?: string | null
          next_wake_at?: string | null
          parked?: Json
          prds: number[]
          repo: string
          seen_at?: string
          started_at?: string
          state?: string
          stopped_at?: string | null
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          last_tick_at?: string | null
          next_wake_at?: string | null
          parked?: Json
          prds?: number[]
          repo?: string
          seen_at?: string
          started_at?: string
          state?: string
          stopped_at?: string | null
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loops_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_items: {
        Row: {
          bears_on: string
          body: string
          dossier_id: string
          id: string
          item: string
          raised: string
          raised_at: string
          raised_by: string
          rank: string
          repository: string | null
          slice: string
          updated_at: string
          wave: number
        }
        Insert: {
          bears_on: string
          body: string
          dossier_id: string
          id?: string
          item: string
          raised: string
          raised_at?: string
          raised_by: string
          rank: string
          repository?: string | null
          slice: string
          updated_at?: string
          wave: number
        }
        Update: {
          bears_on?: string
          body?: string
          dossier_id?: string
          id?: string
          item?: string
          raised?: string
          raised_at?: string
          raised_by?: string
          rank?: string
          repository?: string | null
          slice?: string
          updated_at?: string
          wave?: number
        }
        Relationships: [
          {
            foreignKeyName: "outbox_items_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_sends: {
        Row: {
          comment_url: string | null
          counted: boolean | null
          created_at: string
          dossier_id: string
          error: string | null
          id: string
          login: string | null
          nonce_hash: string
          owner: string
          posted_at: string | null
          pr_number: number
          reply: string
        }
        Insert: {
          comment_url?: string | null
          counted?: boolean | null
          created_at?: string
          dossier_id: string
          error?: string | null
          id?: string
          login?: string | null
          nonce_hash: string
          owner?: string
          posted_at?: string | null
          pr_number: number
          reply: string
        }
        Update: {
          comment_url?: string | null
          counted?: boolean | null
          created_at?: string
          dossier_id?: string
          error?: string | null
          id?: string
          login?: string | null
          nonce_hash?: string
          owner?: string
          posted_at?: string | null
          pr_number?: number
          reply?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbox_sends_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      outbox_settlements: {
        Row: {
          answer: string | null
          basis: string
          channel: string | null
          id: string
          item_id: string
          settled_at: string
          settled_by: string
          settler_login: string
          verdict: string
        }
        Insert: {
          answer?: string | null
          basis: string
          channel?: string | null
          id?: string
          item_id: string
          settled_at?: string
          settled_by: string
          settler_login: string
          verdict: string
        }
        Update: {
          answer?: string | null
          basis?: string
          channel?: string | null
          id?: string
          item_id?: string
          settled_at?: string
          settled_by?: string
          settler_login?: string
          verdict?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbox_settlements_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "outbox_items"
            referencedColumns: ["id"]
          },
        ]
      }
      personas: {
        Row: {
          avatar: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          ordinal: number
          product_id: string
          stance: string
          trade: string
          updated_at: string
          usage: string
          who: string
          workspace_id: string
        }
        Insert: {
          avatar: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name: string
          ordinal?: never
          product_id: string
          stance: string
          trade: string
          updated_at?: string
          usage?: string
          who?: string
          workspace_id: string
        }
        Update: {
          avatar?: Json
          created_at?: string
          created_by?: string | null
          deleted_at?: string | null
          id?: string
          name?: string
          ordinal?: never
          product_id?: string
          stance?: string
          trade?: string
          updated_at?: string
          usage?: string
          who?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personas_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personas_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      pitch_runs: {
        Row: {
          audience: string
          benefit: string
          closing: string
          commit_sha: string
          created_at: string
          created_by: string | null
          dossier_id: string
          files: string[]
          hook: string
          id: string
          kicker: string
          look: string
        }
        Insert: {
          audience: string
          benefit: string
          closing: string
          commit_sha: string
          created_at?: string
          created_by?: string | null
          dossier_id: string
          files: string[]
          hook: string
          id: string
          kicker: string
          look: string
        }
        Update: {
          audience?: string
          benefit?: string
          closing?: string
          commit_sha?: string
          created_at?: string
          created_by?: string | null
          dossier_id?: string
          files?: string[]
          hook?: string
          id?: string
          kicker?: string
          look?: string
        }
        Relationships: [
          {
            foreignKeyName: "pitch_runs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      player_xp: {
        Row: {
          computed_at: string
          github_login: string
          level: number
          unlocked: string[]
          workspace_id: string
          xp: number
        }
        Insert: {
          computed_at: string
          github_login: string
          level: number
          unlocked?: string[]
          workspace_id: string
          xp: number
        }
        Update: {
          computed_at?: string
          github_login?: string
          level?: number
          unlocked?: string[]
          workspace_id?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "player_xp_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          display_name: string
          github_id: number | null
          github_login: string | null
          hero: Json
          team: string | null
          team_since: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          github_id?: number | null
          github_login?: string | null
          hero: Json
          team?: string | null
          team_since?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          github_id?: number | null
          github_login?: string | null
          hero?: Json
          team?: string | null
          team_since?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "players_workspace_id_team_fkey"
            columns: ["workspace_id", "team"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["workspace_id", "name"]
          },
          {
            foreignKeyName: "players_workspace_id_user_id_fkey"
            columns: ["workspace_id", "user_id"]
            isOneToOne: true
            referencedRelation: "workspace_members"
            referencedColumns: ["workspace_id", "user_id"]
          },
        ]
      }
      prd_main_breaks: {
        Row: {
          at: string
          kind: string
          lane: string
          parent: string | null
          prd: number
          repository: string
          source: string
          title: string
          url: string
          workspace_id: string
        }
        Insert: {
          at: string
          kind: string
          lane: string
          parent?: string | null
          prd: number
          repository: string
          source: string
          title: string
          url: string
          workspace_id: string
        }
        Update: {
          at?: string
          kind?: string
          lane?: string
          parent?: string | null
          prd?: number
          repository?: string
          source?: string
          title?: string
          url?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prd_main_breaks_workspace_id_repository_prd_lane_fkey"
            columns: ["workspace_id", "repository", "prd", "lane"]
            isOneToOne: false
            referencedRelation: "prd_main_watch"
            referencedColumns: ["workspace_id", "repository", "prd", "lane"]
          },
        ]
      }
      prd_main_watch: {
        Row: {
          lane: string
          merge_sha: string
          merged_at: string
          prd: number
          repository: string
          status: string
          unread: string[]
          watch_until: string
          workspace_id: string
        }
        Insert: {
          lane: string
          merge_sha: string
          merged_at: string
          prd: number
          repository: string
          status?: string
          unread?: string[]
          watch_until: string
          workspace_id: string
        }
        Update: {
          lane?: string
          merge_sha?: string
          merged_at?: string
          prd?: number
          repository?: string
          status?: string
          unread?: string[]
          watch_until?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prd_main_watch_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      prd_milestones: {
        Row: {
          lane: string
          milestone: string
          pr: number | null
          prd: number
          reached_at: string
          repository: string
          synced_at: string
          workspace_id: string
        }
        Insert: {
          lane: string
          milestone: string
          pr?: number | null
          prd: number
          reached_at: string
          repository: string
          synced_at?: string
          workspace_id: string
        }
        Update: {
          lane?: string
          milestone?: string
          pr?: number | null
          prd?: number
          reached_at?: string
          repository?: string
          synced_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prd_milestones_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      prd_outbox: {
        Row: {
          open_questions: number
          prd: number
          repository: string
          synced_at: string
          waiting: Json
          workspace_id: string
        }
        Insert: {
          open_questions?: number
          prd: number
          repository: string
          synced_at?: string
          waiting?: Json
          workspace_id: string
        }
        Update: {
          open_questions?: number
          prd?: number
          repository?: string
          synced_at?: string
          waiting?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prd_outbox_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      prd_stages: {
        Row: {
          prd: number
          reached_at: string
          repository: string
          stage: string
          synced_at: string
          workspace_id: string
        }
        Insert: {
          prd: number
          reached_at: string
          repository: string
          stage: string
          synced_at?: string
          workspace_id: string
        }
        Update: {
          prd?: number
          reached_at?: string
          repository?: string
          stage?: string
          synced_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prd_stages_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      prd_targets: {
        Row: {
          dossier_id: string
          repository: string
          workspace_id: string
        }
        Insert: {
          dossier_id: string
          repository: string
          workspace_id: string
        }
        Update: {
          dossier_id?: string
          repository?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prd_targets_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prd_targets_workspace_id_repository_fkey"
            columns: ["workspace_id", "repository"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["workspace_id", "full_name"]
          },
        ]
      }
      prd_topics: {
        Row: {
          prd: number
          repository: string
          topic: string
          workspace_id: string
        }
        Insert: {
          prd: number
          repository: string
          topic: string
          workspace_id: string
        }
        Update: {
          prd?: number
          repository?: string
          topic?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prd_topics_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      product_approvers: {
        Row: {
          product_id: string
          set_at: string
          set_by: string | null
          state: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          product_id: string
          set_at?: string
          set_by?: string | null
          state: string
          user_id: string
          workspace_id: string
        }
        Update: {
          product_id?: string
          set_at?: string
          set_by?: string | null
          state?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_approvers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_approvers_workspace_id_user_id_fkey"
            columns: ["workspace_id", "user_id"]
            isOneToOne: false
            referencedRelation: "workspace_members"
            referencedColumns: ["workspace_id", "user_id"]
          },
        ]
      }
      product_glossary: {
        Row: {
          avoid: string[]
          created_at: string
          created_by: string | null
          id: string
          meaning: string
          product_id: string
          removed_at: string | null
          removed_by: string | null
          term: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          avoid?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          meaning: string
          product_id: string
          removed_at?: string | null
          removed_by?: string | null
          term: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          avoid?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          meaning?: string
          product_id?: string
          removed_at?: string | null
          removed_by?: string | null
          term?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_glossary_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_glossary_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      product_knowledge_events: {
        Row: {
          action: string
          after: Json | null
          before: Json | null
          changed_at: string
          changed_by: string | null
          glossary_id: string | null
          id: number
          kind: string
          legal_id: string | null
          product_id: string
          proposal_id: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          after?: Json | null
          before?: Json | null
          changed_at?: string
          changed_by?: string | null
          glossary_id?: string | null
          id?: never
          kind: string
          legal_id?: string | null
          product_id: string
          proposal_id?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          after?: Json | null
          before?: Json | null
          changed_at?: string
          changed_by?: string | null
          glossary_id?: string | null
          id?: never
          kind?: string
          legal_id?: string | null
          product_id?: string
          proposal_id?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_knowledge_events_glossary_id_fkey"
            columns: ["glossary_id"]
            isOneToOne: false
            referencedRelation: "product_glossary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_knowledge_events_legal_id_fkey"
            columns: ["legal_id"]
            isOneToOne: false
            referencedRelation: "product_legal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_knowledge_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_knowledge_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "product_knowledge_proposals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_knowledge_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      product_knowledge_owners: {
        Row: {
          kind: string
          named_at: string
          named_by: string | null
          product_id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          kind: string
          named_at?: string
          named_by?: string | null
          product_id: string
          role: string
          user_id: string
          workspace_id: string
        }
        Update: {
          kind?: string
          named_at?: string
          named_by?: string | null
          product_id?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_knowledge_owners_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_knowledge_owners_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      product_knowledge_proposals: {
        Row: {
          action: string
          decided_at: string | null
          decided_by: string | null
          fields: Json
          glossary_id: string | null
          id: string
          kind: string
          legal_id: string | null
          product_id: string
          proposed_at: string
          proposed_by: string | null
          state: string
          workspace_id: string
        }
        Insert: {
          action: string
          decided_at?: string | null
          decided_by?: string | null
          fields?: Json
          glossary_id?: string | null
          id?: string
          kind: string
          legal_id?: string | null
          product_id: string
          proposed_at?: string
          proposed_by?: string | null
          state?: string
          workspace_id: string
        }
        Update: {
          action?: string
          decided_at?: string | null
          decided_by?: string | null
          fields?: Json
          glossary_id?: string | null
          id?: string
          kind?: string
          legal_id?: string | null
          product_id?: string
          proposed_at?: string
          proposed_by?: string | null
          state?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_knowledge_proposals_glossary_id_fkey"
            columns: ["glossary_id"]
            isOneToOne: false
            referencedRelation: "product_glossary"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_knowledge_proposals_legal_id_fkey"
            columns: ["legal_id"]
            isOneToOne: false
            referencedRelation: "product_legal"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_knowledge_proposals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_knowledge_proposals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      product_legal: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          number: number
          owner_id: string | null
          product_id: string
          retired_at: string | null
          retired_by: string | null
          source: string
          statement: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          number: number
          owner_id?: string | null
          product_id: string
          retired_at?: string | null
          retired_by?: string | null
          source: string
          statement: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          number?: number
          owner_id?: string | null
          product_id?: string
          retired_at?: string | null
          retired_by?: string | null
          source?: string
          statement?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_legal_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_legal_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      product_repositories: {
        Row: {
          added_at: string
          added_by: string
          consumes: string[]
          knowledge: string
          ladder_step: number
          product_id: string
          read_at: string | null
          read_only: boolean
          repository: string
          role: string | null
          workspace_id: string
        }
        Insert: {
          added_at?: string
          added_by: string
          consumes?: string[]
          knowledge?: string
          ladder_step?: number
          product_id: string
          read_at?: string | null
          read_only?: boolean
          repository: string
          role?: string | null
          workspace_id: string
        }
        Update: {
          added_at?: string
          added_by?: string
          consumes?: string[]
          knowledge?: string
          ladder_step?: number
          product_id?: string
          read_at?: string | null
          read_only?: boolean
          repository?: string
          role?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_repositories_product_id_workspace_id_fkey"
            columns: ["product_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "product_repositories_workspace_id_repository_fkey"
            columns: ["workspace_id", "repository"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["workspace_id", "full_name"]
          },
        ]
      }
      products: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          bug_seq: number
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          key: string | null
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
          plan_repository: string | null
          prd_count: number
          roadmap_seq: number
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          bug_seq?: number
          business_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          key?: string | null
          name: string
          ordinal?: never
          pitch?: Json
          pitch_look?: string
          plan_repository?: string | null
          prd_count?: number
          roadmap_seq?: number
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          bug_seq?: number
          business_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          key?: string | null
          name?: string
          ordinal?: never
          pitch?: Json
          pitch_look?: string
          plan_repository?: string | null
          prd_count?: number
          roadmap_seq?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_plan_repository_listed"
            columns: ["workspace_id", "plan_repository"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["workspace_id", "full_name"]
          },
          {
            foreignKeyName: "products_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      proof_runs: {
        Row: {
          commit_sha: string
          created_at: string
          created_by: string | null
          criteria: Json
          dossier_id: string
          gif: string | null
          id: string
          url: string
        }
        Insert: {
          commit_sha: string
          created_at?: string
          created_by?: string | null
          criteria: Json
          dossier_id: string
          gif?: string | null
          id: string
          url: string
        }
        Update: {
          commit_sha?: string
          created_at?: string
          created_by?: string | null
          criteria?: Json
          dossier_id?: string
          gif?: string | null
          id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "proof_runs_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
        ]
      }
      pull_request_reviews: {
        Row: {
          first_at: string
          number: number
          repo: string
          reviewer: string
          workspace_id: string
        }
        Insert: {
          first_at: string
          number: number
          repo: string
          reviewer: string
          workspace_id: string
        }
        Update: {
          first_at?: string
          number?: number
          repo?: string
          reviewer?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pull_request_reviews_workspace_id_repo_number_fkey"
            columns: ["workspace_id", "repo", "number"]
            isOneToOne: false
            referencedRelation: "pull_requests"
            referencedColumns: ["workspace_id", "repo", "number"]
          },
        ]
      }
      pull_requests: {
        Row: {
          additions: number
          author: string | null
          author_is_bot: boolean
          base: string | null
          closed_at: string | null
          commits: number
          deletions: number
          draft: boolean
          head: string | null
          head_committed_at: string | null
          labels: string[]
          merged_at: string | null
          merged_by: string | null
          needs_fix_at: string | null
          number: number
          omni_signed: boolean
          opened_at: string
          repo: string
          status_state: string | null
          workspace_id: string
        }
        Insert: {
          additions?: number
          author?: string | null
          author_is_bot?: boolean
          base?: string | null
          closed_at?: string | null
          commits?: number
          deletions?: number
          draft?: boolean
          head?: string | null
          head_committed_at?: string | null
          labels?: string[]
          merged_at?: string | null
          merged_by?: string | null
          needs_fix_at?: string | null
          number: number
          omni_signed?: boolean
          opened_at: string
          repo: string
          status_state?: string | null
          workspace_id: string
        }
        Update: {
          additions?: number
          author?: string | null
          author_is_bot?: boolean
          base?: string | null
          closed_at?: string | null
          commits?: number
          deletions?: number
          draft?: boolean
          head?: string | null
          head_committed_at?: string | null
          labels?: string[]
          merged_at?: string | null
          merged_by?: string | null
          needs_fix_at?: string | null
          number?: number
          omni_signed?: boolean
          opened_at?: string
          repo?: string
          status_state?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pull_requests_workspace_id_repo_fkey"
            columns: ["workspace_id", "repo"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["workspace_id", "full_name"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          device_label: string
          endpoint: string
          id: string
          p256dh: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          device_label?: string
          endpoint: string
          id?: string
          p256dh: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          device_label?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_id?: string
        }
        Relationships: []
      }
      releases: {
        Row: {
          description: string
          prd: number
          release: number
          released_at: string
          title: string
        }
        Insert: {
          description?: string
          prd: number
          release: number
          released_at: string
          title: string
        }
        Update: {
          description?: string
          prd?: number
          release?: number
          released_at?: string
          title?: string
        }
        Relationships: []
      }
      repositories: {
        Row: {
          added_at: string
          added_by: string | null
          collect_error: string | null
          collected_at: string | null
          collected_until: string | null
          fix_when_answered: boolean
          full_name: string
          phase0: string
          public_ideas: boolean
          removed_at: string | null
          tracked: boolean
          workspace_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          collect_error?: string | null
          collected_at?: string | null
          collected_until?: string | null
          fix_when_answered?: boolean
          full_name: string
          phase0?: string
          public_ideas?: boolean
          removed_at?: string | null
          tracked?: boolean
          workspace_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          collect_error?: string | null
          collected_at?: string | null
          collected_until?: string | null
          fix_when_answered?: boolean
          full_name?: string
          phase0?: string
          public_ideas?: boolean
          removed_at?: string | null
          tracked?: boolean
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repositories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      repository_runner_skills: {
        Row: {
          allowed_at: string
          allowed_by: string | null
          full_name: string
          skill: string
          workspace_id: string
        }
        Insert: {
          allowed_at?: string
          allowed_by?: string | null
          full_name: string
          skill: string
          workspace_id: string
        }
        Update: {
          allowed_at?: string
          allowed_by?: string | null
          full_name?: string
          skill?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "repository_runner_skills_workspace_id_full_name_fkey"
            columns: ["workspace_id", "full_name"]
            isOneToOne: false
            referencedRelation: "repositories"
            referencedColumns: ["workspace_id", "full_name"]
          },
        ]
      }
      rewind_finding_events: {
        Row: {
          action: string
          changed_at: string
          changed_by: string | null
          finding_id: string
          id: number
          reason: string | null
          workspace_id: string
        }
        Insert: {
          action: string
          changed_at?: string
          changed_by?: string | null
          finding_id: string
          id?: never
          reason?: string | null
          workspace_id: string
        }
        Update: {
          action?: string
          changed_at?: string
          changed_by?: string | null
          finding_id?: string
          id?: never
          reason?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewind_finding_events_finding_id_fkey"
            columns: ["finding_id"]
            isOneToOne: false
            referencedRelation: "rewind_findings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rewind_finding_events_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      rewind_findings: {
        Row: {
          check_name: string
          decided_at: string | null
          decided_by: string | null
          evidence: Json
          fix: string
          happened: string
          id: string
          origin: string
          prd: number
          proposed_at: string
          reason: string | null
          repository: string
          state: string
          workspace_id: string
        }
        Insert: {
          check_name: string
          decided_at?: string | null
          decided_by?: string | null
          evidence: Json
          fix: string
          happened: string
          id?: string
          origin: string
          prd: number
          proposed_at?: string
          reason?: string | null
          repository: string
          state?: string
          workspace_id: string
        }
        Update: {
          check_name?: string
          decided_at?: string | null
          decided_by?: string | null
          evidence?: Json
          fix?: string
          happened?: string
          id?: string
          origin?: string
          prd?: number
          proposed_at?: string
          reason?: string | null
          repository?: string
          state?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rewind_findings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_human_work: {
        Row: {
          act: string | null
          classified_at: string | null
          done_at: string | null
          first_seen_at: string
          key: string
          kind: string
          kind_by: string
          prd: number | null
          repo: string
          roadmap_id: string
          source: string
          state: string
          text: string
          url: string | null
        }
        Insert: {
          act?: string | null
          classified_at?: string | null
          done_at?: string | null
          first_seen_at?: string
          key: string
          kind: string
          kind_by: string
          prd?: number | null
          repo: string
          roadmap_id: string
          source: string
          state?: string
          text: string
          url?: string | null
        }
        Update: {
          act?: string | null
          classified_at?: string | null
          done_at?: string | null
          first_seen_at?: string
          key?: string
          kind?: string
          kind_by?: string
          prd?: number | null
          repo?: string
          roadmap_id?: string
          source?: string
          state?: string
          text?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_human_work_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "roadmaps"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_prds: {
        Row: {
          blockers: string[]
          ended_at: string | null
          position: number
          prd: number | null
          prd_id: string
          repos: string[]
          roadmap_id: string
          row_id: string
          started_at: string | null
          state: string
          title: string
          waits_on: string | null
          waits_on_url: string | null
          wave: number
        }
        Insert: {
          blockers?: string[]
          ended_at?: string | null
          position: number
          prd?: number | null
          prd_id: string
          repos?: string[]
          roadmap_id: string
          row_id: string
          started_at?: string | null
          state: string
          title: string
          waits_on?: string | null
          waits_on_url?: string | null
          wave: number
        }
        Update: {
          blockers?: string[]
          ended_at?: string | null
          position?: number
          prd?: number | null
          prd_id?: string
          repos?: string[]
          roadmap_id?: string
          row_id?: string
          started_at?: string | null
          state?: string
          title?: string
          waits_on?: string | null
          waits_on_url?: string | null
          wave?: number
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_prds_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "roadmaps"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmap_prerequisites: {
        Row: {
          blocks: string[]
          blocks_all: boolean
          card: Json | null
          category: string
          check_with: string | null
          detail: string | null
          fix_with: string | null
          need: string
          position: number
          repos: string[]
          roadmap_id: string
          row_id: string
          state: string | null
          who: string
        }
        Insert: {
          blocks?: string[]
          blocks_all?: boolean
          card?: Json | null
          category: string
          check_with?: string | null
          detail?: string | null
          fix_with?: string | null
          need: string
          position: number
          repos?: string[]
          roadmap_id: string
          row_id: string
          state?: string | null
          who: string
        }
        Update: {
          blocks?: string[]
          blocks_all?: boolean
          card?: Json | null
          category?: string
          check_with?: string | null
          detail?: string | null
          fix_with?: string | null
          need?: string
          position?: number
          repos?: string[]
          roadmap_id?: string
          row_id?: string
          state?: string | null
          who?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmap_prerequisites_roadmap_id_fkey"
            columns: ["roadmap_id"]
            isOneToOne: false
            referencedRelation: "roadmaps"
            referencedColumns: ["id"]
          },
        ]
      }
      roadmaps: {
        Row: {
          created_at: string
          document: string
          dossier_id: string | null
          id: string
          milestone: string
          number: number | null
          prerequisites_checked_at: string | null
          prerequisites_machine: string | null
          product_id: string | null
          pushed_at: string
          pushed_by: string | null
          questions: Json
          repo: string | null
          source: string | null
          target_date: string | null
          title: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          document: string
          dossier_id?: string | null
          id?: string
          milestone: string
          number?: number | null
          prerequisites_checked_at?: string | null
          prerequisites_machine?: string | null
          product_id?: string | null
          pushed_at?: string
          pushed_by?: string | null
          questions?: Json
          repo?: string | null
          source?: string | null
          target_date?: string | null
          title: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          document?: string
          dossier_id?: string | null
          id?: string
          milestone?: string
          number?: number | null
          prerequisites_checked_at?: string | null
          prerequisites_machine?: string | null
          product_id?: string | null
          pushed_at?: string
          pushed_by?: string | null
          questions?: Json
          repo?: string | null
          source?: string | null
          target_date?: string | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roadmaps_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: true
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "roadmaps_product_fkey"
            columns: ["product_id", "workspace_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id", "workspace_id"]
          },
          {
            foreignKeyName: "roadmaps_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      runner_job_lines: {
        Row: {
          at: string
          job_id: string
          seq: number
          text: string
          workspace_id: string
        }
        Insert: {
          at?: string
          job_id: string
          seq: number
          text: string
          workspace_id: string
        }
        Update: {
          at?: string
          job_id?: string
          seq?: number
          text?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runner_job_lines_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "runner_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_job_lines_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      runner_job_needs_app: {
        Row: {
          job_id: string
          marked_at: string
        }
        Insert: {
          job_id: string
          marked_at?: string
        }
        Update: {
          job_id?: string
          marked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "runner_job_needs_app_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "runner_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      runner_job_questions: {
        Row: {
          answers: Json | null
          asked_at: string
          closed_at: string | null
          closed_by: string | null
          closed_by_key: string | null
          closed_for: string | null
          issue: number
          job_id: string
          lead: string
          questions: Json
          resume_job: string | null
          workspace_id: string
        }
        Insert: {
          answers?: Json | null
          asked_at?: string
          closed_at?: string | null
          closed_by?: string | null
          closed_by_key?: string | null
          closed_for?: string | null
          issue: number
          job_id: string
          lead: string
          questions: Json
          resume_job?: string | null
          workspace_id: string
        }
        Update: {
          answers?: Json | null
          asked_at?: string
          closed_at?: string | null
          closed_by?: string | null
          closed_by_key?: string | null
          closed_for?: string | null
          issue?: number
          job_id?: string
          lead?: string
          questions?: Json
          resume_job?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runner_job_questions_closed_by_key_fkey"
            columns: ["closed_by_key"]
            isOneToOne: false
            referencedRelation: "agent_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_job_questions_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: true
            referencedRelation: "runner_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_job_questions_resume_job_fkey"
            columns: ["resume_job"]
            isOneToOne: false
            referencedRelation: "runner_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_job_questions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      runner_jobs: {
        Row: {
          acting_for: string | null
          cancel_requested: boolean
          cancelled_by_key: string | null
          cancelled_for: string | null
          claimed_at: string | null
          continues: string | null
          ended_at: string | null
          exit_code: number | null
          fixed_by: string | null
          follow_ups: Json
          id: string
          line: string
          log_tail: string
          notify_url: string | null
          outcome: string | null
          pr_url: string | null
          prs: Json
          queued_at: string
          reason: string | null
          release_error: string | null
          released: number[] | null
          repo: string
          runner_id: string | null
          running_at: string | null
          sent_by: string | null
          sent_by_app: string | null
          sent_by_key: string | null
          slices_merged: number | null
          slices_total: number | null
          status: string
          to_fleet: string | null
          to_runner: string | null
          tokens: Json | null
          workspace_id: string
        }
        Insert: {
          acting_for?: string | null
          cancel_requested?: boolean
          cancelled_by_key?: string | null
          cancelled_for?: string | null
          claimed_at?: string | null
          continues?: string | null
          ended_at?: string | null
          exit_code?: number | null
          fixed_by?: string | null
          follow_ups?: Json
          id?: string
          line: string
          log_tail?: string
          notify_url?: string | null
          outcome?: string | null
          pr_url?: string | null
          prs?: Json
          queued_at?: string
          reason?: string | null
          release_error?: string | null
          released?: number[] | null
          repo: string
          runner_id?: string | null
          running_at?: string | null
          sent_by?: string | null
          sent_by_app?: string | null
          sent_by_key?: string | null
          slices_merged?: number | null
          slices_total?: number | null
          status?: string
          to_fleet?: string | null
          to_runner?: string | null
          tokens?: Json | null
          workspace_id: string
        }
        Update: {
          acting_for?: string | null
          cancel_requested?: boolean
          cancelled_by_key?: string | null
          cancelled_for?: string | null
          claimed_at?: string | null
          continues?: string | null
          ended_at?: string | null
          exit_code?: number | null
          fixed_by?: string | null
          follow_ups?: Json
          id?: string
          line?: string
          log_tail?: string
          notify_url?: string | null
          outcome?: string | null
          pr_url?: string | null
          prs?: Json
          queued_at?: string
          reason?: string | null
          release_error?: string | null
          released?: number[] | null
          repo?: string
          runner_id?: string | null
          running_at?: string | null
          sent_by?: string | null
          sent_by_app?: string | null
          sent_by_key?: string | null
          slices_merged?: number | null
          slices_total?: number | null
          status?: string
          to_fleet?: string | null
          to_runner?: string | null
          tokens?: Json | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runner_jobs_cancelled_by_key_fkey"
            columns: ["cancelled_by_key"]
            isOneToOne: false
            referencedRelation: "agent_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_jobs_continues_fkey"
            columns: ["continues"]
            isOneToOne: false
            referencedRelation: "runner_jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_jobs_runner_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "runners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_jobs_sent_by_key_fkey"
            columns: ["sent_by_key"]
            isOneToOne: false
            referencedRelation: "agent_tokens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_jobs_to_runner_fkey"
            columns: ["to_runner"]
            isOneToOne: false
            referencedRelation: "runners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_jobs_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_jobs_workspace_id_to_fleet_fkey"
            columns: ["workspace_id", "to_fleet"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["workspace_id", "name"]
          },
        ]
      }
      runner_samples: {
        Row: {
          at: string
          cpu: number | null
          disk_free: number | null
          mem_total: number | null
          mem_used: number | null
          runner_id: string
          tokens_5h: number | null
          workspace_id: string
        }
        Insert: {
          at?: string
          cpu?: number | null
          disk_free?: number | null
          mem_total?: number | null
          mem_used?: number | null
          runner_id: string
          tokens_5h?: number | null
          workspace_id: string
        }
        Update: {
          at?: string
          cpu?: number | null
          disk_free?: number | null
          mem_total?: number | null
          mem_used?: number | null
          runner_id?: string
          tokens_5h?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runner_samples_runner_id_fkey"
            columns: ["runner_id"]
            isOneToOne: false
            referencedRelation: "runners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runner_samples_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      runners: {
        Row: {
          created_at: string
          fleet: string | null
          github_app: boolean
          health: Json | null
          id: string
          last_seen_at: string
          name: string
          owner: string
          repos: string[]
          slots: number
          version: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          fleet?: string | null
          github_app?: boolean
          health?: Json | null
          id?: string
          last_seen_at?: string
          name: string
          owner: string
          repos?: string[]
          slots?: number
          version?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          fleet?: string | null
          github_app?: boolean
          health?: Json | null
          id?: string
          last_seen_at?: string
          name?: string
          owner?: string
          repos?: string[]
          slots?: number
          version?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "runners_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "runners_workspace_id_fleet_fkey"
            columns: ["workspace_id", "fleet"]
            isOneToOne: false
            referencedRelation: "teams"
            referencedColumns: ["workspace_id", "name"]
          },
        ]
      }
      sectors: {
        Row: {
          name: string
          repos: string[]
          workspace_id: string
        }
        Insert: {
          name: string
          repos?: string[]
          workspace_id: string
        }
        Update: {
          name?: string
          repos?: string[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sectors_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      signup_requests: {
        Row: {
          created_at: string
          github_org: string
          user_id: string
        }
        Insert: {
          created_at?: string
          github_org: string
          user_id: string
        }
        Update: {
          created_at?: string
          github_org?: string
          user_id?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          color: string
          home: string | null
          label: string
          mascot: string | null
          motto: string
          name: string
          project_note: string | null
          project_noted_at: string | null
          project_url: string | null
          retired_at: string | null
          sort: number
          workspace_id: string
        }
        Insert: {
          color: string
          home?: string | null
          label: string
          mascot?: string | null
          motto?: string
          name: string
          project_note?: string | null
          project_noted_at?: string | null
          project_url?: string | null
          retired_at?: string | null
          sort?: number
          workspace_id: string
        }
        Update: {
          color?: string
          home?: string | null
          label?: string
          mascot?: string | null
          motto?: string
          name?: string
          project_note?: string | null
          project_noted_at?: string | null
          project_url?: string | null
          retired_at?: string | null
          sort?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "teams_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "teams_workspace_id_home_fkey"
            columns: ["workspace_id", "home"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["workspace_id", "name"]
          },
        ]
      }
      waits: {
        Row: {
          ended_at: string | null
          id: string
          kind: string
          pr: number | null
          prd: number | null
          repo: string
          seen_at: string
          since: string
          turn: string[]
          workspace_id: string
        }
        Insert: {
          ended_at?: string | null
          id?: string
          kind: string
          pr?: number | null
          prd?: number | null
          repo: string
          seen_at: string
          since: string
          turn?: string[]
          workspace_id: string
        }
        Update: {
          ended_at?: string | null
          id?: string
          kind?: string
          pr?: number | null
          prd?: number | null
          repo?: string
          seen_at?: string
          since?: string
          turn?: string[]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "waits_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      working_pings: {
        Row: {
          claude_session_id: string
          dossier_id: string | null
          ended_at: string | null
          repo: string
          seen_at: string
          user_id: string
          work_kind: string | null
          work_number: number | null
          workspace_id: string
        }
        Insert: {
          claude_session_id: string
          dossier_id?: string | null
          ended_at?: string | null
          repo: string
          seen_at?: string
          user_id: string
          work_kind?: string | null
          work_number?: number | null
          workspace_id: string
        }
        Update: {
          claude_session_id?: string
          dossier_id?: string | null
          ended_at?: string | null
          repo?: string
          seen_at?: string
          user_id?: string
          work_kind?: string | null
          work_number?: number | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "working_pings_dossier_id_fkey"
            columns: ["dossier_id"]
            isOneToOne: false
            referencedRelation: "dossiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "working_pings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          joined_at: string
          role: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          joined_at?: string
          role?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          joined_at?: string
          role?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_secrets: {
        Row: {
          ciphertext: string
          iv: string
          last_four: string
          name: string
          set_at: string
          set_by: string | null
          workspace_id: string
        }
        Insert: {
          ciphertext: string
          iv: string
          last_four: string
          name: string
          set_at?: string
          set_by?: string | null
          workspace_id: string
        }
        Update: {
          ciphertext?: string
          iv?: string
          last_four?: string
          name?: string
          set_at?: string
          set_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_secrets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          game_since: string
          github_account_type: string | null
          github_installation_id: number | null
          github_org: string | null
          id: string
          name: string
          plan_repo: string | null
          settings_repository: string | null
          slug: string
          theme: Json
        }
        Insert: {
          created_at?: string
          game_since?: string
          github_account_type?: string | null
          github_installation_id?: number | null
          github_org?: string | null
          id?: string
          name: string
          plan_repo?: string | null
          settings_repository?: string | null
          slug: string
          theme?: Json
        }
        Update: {
          created_at?: string
          game_since?: string
          github_account_type?: string | null
          github_installation_id?: number | null
          github_org?: string | null
          id?: string
          name?: string
          plan_repo?: string | null
          settings_repository?: string | null
          slug?: string
          theme?: Json
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_repository: {
        Args: { p_full_name: string; p_workspace: string }
        Returns: {
          added_at: string
          added_by: string | null
          collect_error: string | null
          collected_at: string | null
          collected_until: string | null
          fix_when_answered: boolean
          full_name: string
          phase0: string
          public_ideas: boolean
          removed_at: string | null
          tracked: boolean
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "repositories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      agent_link_workspace: { Args: { p_hash: string }; Returns: string }
      agent_question_answer: {
        Args: {
          p_kind: string
          p_product?: string
          p_question: string
          p_value: string
          p_workspace: string
        }
        Returns: Json
      }
      agent_question_bring_back: {
        Args: { p_question: string; p_workspace: string }
        Returns: Json
      }
      agent_question_dismiss: {
        Args: { p_question: string; p_workspace: string }
        Returns: Json
      }
      agent_question_for_jev: { Args: { p_question: string }; Returns: Json }
      agent_question_open: {
        Args: { p_question: string; p_workspace: string }
        Returns: {
          asked: number
          brought_back_at: string | null
          claim_id: string | null
          closed_at: string | null
          closed_by: string | null
          file: string | null
          first_asked_at: string
          id: string
          last_asked_at: string
          match_key: string
          question: string
          repo: string | null
          set_aside_at: string | null
          state: string
          token_id: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "agent_questions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      agent_question_product: {
        Args: {
          p_product: string
          q: Database["public"]["Tables"]["agent_questions"]["Row"]
        }
        Returns: string
      }
      agent_question_report: {
        Args: {
          p_file?: string
          p_hash: string
          p_question: string
          p_repo?: string
        }
        Returns: Json
      }
      agent_question_set_aside: { Args: { p_question: string }; Returns: Json }
      agent_questions_list: { Args: { p_workspace: string }; Returns: Json }
      agent_questions_open: { Args: { p_workspace: string }; Returns: number }
      agent_token_listed: {
        Args: { t: Database["public"]["Tables"]["agent_tokens"]["Row"] }
        Returns: Json
      }
      agent_token_make: {
        Args: {
          p_hash: string
          p_last_four: string
          p_name: string
          p_workspace: string
        }
        Returns: Json
      }
      agent_token_of: {
        Args: { p_hash: string }
        Returns: {
          created_at: string
          expires_at: string | null
          id: string
          last_four: string
          last_used_at: string | null
          made_by: string
          name: string
          repos: string[]
          revoked_at: string | null
          revoked_by: string | null
          scope: string
          session: string | null
          session_lease: string | null
          session_lease_until: string | null
          token_hash: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "agent_tokens"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      agent_token_revoke: {
        Args: { p_token: string; p_workspace: string }
        Returns: Json
      }
      agent_tokens_list: { Args: { p_workspace: string }; Returns: Json }
      agent_tokens_live: { Args: { p_person: string }; Returns: number }
      answered_counts: {
        Args: { from_at: string; to_at: string; workspace: string }
        Returns: {
          answered: number
          user_id: string
        }[]
      }
      api_key_github_app_attach: {
        Args: {
          p_app_id: number
          p_bot_id: number
          p_ciphertext: string
          p_iv: string
          p_key: string
          p_slug: string
        }
        Returns: Json
      }
      api_key_github_app_minted: { Args: { p_key: string }; Returns: undefined }
      api_key_github_app_of_job: { Args: { p_job: string }; Returns: Json }
      api_key_github_app_of_key: { Args: { p_key: string }; Returns: Json }
      api_key_github_app_remove: { Args: { p_key: string }; Returns: boolean }
      api_key_github_apps_list: { Args: { p_workspace: string }; Returns: Json }
      api_key_listed: {
        Args: { t: Database["public"]["Tables"]["agent_tokens"]["Row"] }
        Returns: Json
      }
      api_key_make: {
        Args: {
          p_hash: string
          p_last_four: string
          p_name: string
          p_repos: string[]
          p_workspace: string
        }
        Returns: string
      }
      api_key_names: {
        Args: { p_keys: string[]; p_workspace: string }
        Returns: Json
      }
      api_key_of: { Args: { p_hash: string }; Returns: Json }
      api_key_revoke: {
        Args: { p_key: string; p_workspace: string }
        Returns: Json
      }
      api_keys_list: { Args: { p_workspace: string }; Returns: Json }
      approval_people: { Args: { p_dossier: string }; Returns: Json }
      approval_recipients: { Args: { p_request: string }; Returns: Json }
      approval_request: {
        Args: { p_prd: number; p_product?: string; p_repo: string }
        Returns: Json
      }
      approval_requests_waiting: { Args: never; Returns: Json }
      approval_void_recipients: { Args: { p_void: string }; Returns: Json }
      approval_voids_of_push: { Args: { p_dossier: string }; Returns: Json }
      ask_answers_valid: { Args: { a: Json }; Returns: boolean }
      ask_attachment_round: { Args: { path: string }; Returns: string }
      ask_attachments_valid: {
        Args: { a: Json; round: string }
        Returns: boolean
      }
      ask_cli_code_issue: {
        Args: { p_code_hash: string; p_refresh_token: string }
        Returns: string
      }
      ask_cli_code_redeem: {
        Args: { p_code_hash: string }
        Returns: {
          expires_at: string
          owner: string
          refresh_token: string
        }[]
      }
      ask_cli_device_approve: {
        Args: {
          p_now: string
          p_payload: string
          p_payload_expires_at?: string
          p_purpose: string
          p_user_code: string
        }
        Returns: boolean
      }
      ask_cli_device_deny: {
        Args: { p_now: string; p_user_code: string }
        Returns: boolean
      }
      ask_cli_device_find: {
        Args: { p_user_code: string }
        Returns: {
          days: number
          expires_at: string
          last_polled_at: string
          name: string
          poll_interval: number
          purpose: string
          status: string
          workspace: string
        }[]
      }
      ask_cli_device_issue: {
        Args: {
          p_days?: number
          p_device_hash: string
          p_expires_at: string
          p_name?: string
          p_now: string
          p_purpose: string
          p_user_code: string
          p_workspace?: string
        }
        Returns: boolean
      }
      ask_cli_device_polled: {
        Args: { p_device_hash: string; p_interval: number; p_polled_at: string }
        Returns: undefined
      }
      ask_cli_device_read: {
        Args: { p_device_hash: string }
        Returns: {
          days: number
          expires_at: string
          last_polled_at: string
          name: string
          poll_interval: number
          purpose: string
          status: string
          workspace: string
        }[]
      }
      ask_cli_device_take: {
        Args: { p_device_hash: string }
        Returns: {
          payload: string
          payload_expires_at: string
          purpose: string
        }[]
      }
      ask_may_answer: { Args: { round: string }; Returns: boolean }
      ask_members: {
        Args: { workspace: string }
        Returns: {
          email: string
          name: string
          user_id: string
        }[]
      }
      ask_owns_round: { Args: { round: string }; Returns: boolean }
      ask_round_categorize: {
        Args: { new_category: string; round_id: string }
        Returns: {
          category: string
          category_by: string
        }[]
      }
      ask_round_classified: {
        Args: { new_category: string; round_id: string }
        Returns: boolean
      }
      ask_round_share: {
        Args: { p_member: string; p_round_id: string }
        Returns: boolean
      }
      ask_shared_with_me: { Args: { round: string }; Returns: boolean }
      ask_sweep: { Args: never; Returns: number }
      ask_tokens_valid: { Args: { t: Json }; Returns: boolean }
      bug_id_of: { Args: { p_product: string; p_seq: number }; Returns: string }
      business_archived: {
        Args: {
          p: Database["public"]["Tables"]["products"]["Row"]
          p_workspace: string
        }
        Returns: Json
      }
      business_claim_value: {
        Args: { p_kind: string; p_value: string }
        Returns: string
      }
      business_draft_finish: {
        Args: {
          p_counts?: Json
          p_draft: string
          p_reason?: string
          p_scanned?: Json
          p_state: string
          p_workspace: string
        }
        Returns: {
          business_id: string
          counts: Json
          finished_at: string | null
          id: string
          kind: string
          reason: string | null
          scanned: Json
          started_at: string
          started_by: string | null
          state: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "business_drafts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      business_draft_progress: {
        Args: {
          p_counts: Json
          p_draft: string
          p_scanned: Json
          p_workspace: string
        }
        Returns: {
          business_id: string
          counts: Json
          finished_at: string | null
          id: string
          kind: string
          reason: string | null
          scanned: Json
          started_at: string
          started_by: string | null
          state: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "business_drafts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      business_draft_running: {
        Args: { p_draft: string; p_workspace: string }
        Returns: {
          business_id: string
          counts: Json
          finished_at: string | null
          id: string
          kind: string
          reason: string | null
          scanned: Json
          started_at: string
          started_by: string | null
          state: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "business_drafts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      business_draft_shape: {
        Args: { p_counts: Json; p_scanned: Json }
        Returns: undefined
      }
      business_draft_start: {
        Args: { p_kind?: string; p_workspace: string }
        Returns: {
          business_id: string
          counts: Json
          finished_at: string | null
          id: string
          kind: string
          reason: string | null
          scanned: Json
          started_at: string
          started_by: string | null
          state: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "business_drafts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      business_first_product: { Args: { p_workspace: string }; Returns: string }
      business_for_product: {
        Args: { p_product: string; p_workspace: string }
        Returns: Json
      }
      business_for_repo: {
        Args: { p_prd?: number; p_repo: string }
        Returns: Json
      }
      business_for_repo_app: { Args: { p_repo: string }; Returns: Json }
      business_for_token: {
        Args: { p_hash: string; p_prd?: number; p_repo?: string }
        Returns: Json
      }
      business_member_only: {
        Args: { p_workspace: string }
        Returns: undefined
      }
      business_of: {
        Args: { p_workspace: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "businesses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      business_open: {
        Args: { p_workspace: string }
        Returns: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "businesses"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      business_product: {
        Args: { p_product: string; p_workspace: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          bug_seq: number
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          key: string | null
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
          plan_repository: string | null
          prd_count: number
          roadmap_seq: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      business_runner_only: {
        Args: { p_workspace: string }
        Returns: undefined
      }
      business_size_check: { Args: { p_value: string }; Returns: undefined }
      business_size_stop: { Args: { p_stop: string }; Returns: number }
      business_source_add: {
        Args: { p_url: string; p_workspace: string }
        Returns: {
          added_at: string
          added_by: string | null
          business_id: string
          id: string
          url: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "business_sources"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      business_source_remove: {
        Args: { p_source: string; p_workspace: string }
        Returns: undefined
      }
      business_text: {
        Args: { p_field: string; p_label: string; p_value: string }
        Returns: string
      }
      business_to_check: { Args: { p_workspace: string }; Returns: number }
      business_workspace: { Args: { p_repo: string }; Returns: string }
      claim_answer: {
        Args: {
          p_kind: string
          p_prd?: number
          p_ref: string
          p_repo: string
          p_state: string
          p_value: string
        }
        Returns: Json
      }
      claim_pick: {
        Args: {
          p_kind: string
          p_product: string
          p_source?: string
          p_value: string
          p_workspace: string
        }
        Returns: {
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          last_seen: string | null
          product_id: string | null
          receipt: string | null
          replaces: string | null
          seq: number
          source: string
          state: string
          updated_at: string
          value: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "claims"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_propose_evidence: {
        Args: {
          p_kind: string
          p_product: string
          p_receipts: Json
          p_value: string
          p_workspace: string
        }
        Returns: Json
      }
      claim_receipts_add: {
        Args: {
          p_claim: Database["public"]["Tables"]["claims"]["Row"]
          p_receipts: Json
        }
        Returns: undefined
      }
      claim_set_state: {
        Args: { p_claim: string; p_state: string; p_workspace: string }
        Returns: {
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          last_seen: string | null
          product_id: string | null
          receipt: string | null
          replaces: string | null
          seq: number
          source: string
          state: string
          updated_at: string
          value: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "claims"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_settle_replacement: {
        Args: { p_claim: string; p_right: boolean; p_workspace: string }
        Returns: {
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          last_seen: string | null
          product_id: string | null
          receipt: string | null
          replaces: string | null
          seq: number
          source: string
          state: string
          updated_at: string
          value: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "claims"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claim_still_true: {
        Args: { p_claim: string; p_workspace: string }
        Returns: {
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          last_seen: string | null
          product_id: string | null
          receipt: string | null
          replaces: string | null
          seq: number
          source: string
          state: string
          updated_at: string
          value: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "claims"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      claims_cite: {
        Args: { p_by: string; p_ids: string[]; p_ref?: string; p_repo: string }
        Returns: number
      }
      claims_confirm_proposed: {
        Args: { p_rejected?: string[]; p_workspace: string }
        Returns: number
      }
      constituent_add: {
        Args: {
          p_kind: string
          p_product: string
          p_text: string
          p_workspace: string
        }
        Returns: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          product_id: string
          removed_at: string | null
          removed_by: string | null
          seq: number | null
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "constituents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      constituent_edit: {
        Args: { p_constituent: string; p_text: string; p_workspace: string }
        Returns: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          product_id: string
          removed_at: string | null
          removed_by: string | null
          seq: number | null
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "constituents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      constituent_live: {
        Args: { p_constituent: string; p_workspace: string }
        Returns: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          product_id: string
          removed_at: string | null
          removed_by: string | null
          seq: number | null
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "constituents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      constituent_remove: {
        Args: { p_constituent: string; p_workspace: string }
        Returns: {
          body: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          product_id: string
          removed_at: string | null
          removed_by: string | null
          seq: number | null
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "constituents"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      constituent_text: {
        Args: { p_kind: string; p_text: string }
        Returns: string
      }
      constituents_for_repo: {
        Args: { p_prd?: number; p_repo: string }
        Returns: Json
      }
      constituents_for_repo_app: { Args: { p_repo: string }; Returns: Json }
      constituents_move_never_claims: { Args: never; Returns: number }
      constituents_of_product: { Args: { p_product: string }; Returns: Json }
      constituents_owner_only: {
        Args: { p_workspace: string }
        Returns: undefined
      }
      create_fleet: {
        Args: {
          p_color: string
          p_label: string
          p_mascot?: string
          p_motto?: string
          p_workspace: string
        }
        Returns: {
          color: string
          home: string | null
          label: string
          mascot: string | null
          motto: string
          name: string
          project_note: string | null
          project_noted_at: string | null
          project_url: string | null
          retired_at: string | null
          sort: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "teams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_workspace_from_installation: {
        Args: {
          p_installation_id: number
          p_login: string
          p_type: string
          p_user_id: string
        }
        Returns: Json
      }
      dossier_add_version: {
        Args: {
          p_commit_sha?: string
          p_content: string
          p_dossier: string
          p_git_blob?: string
          p_kind: string
          p_source: string
          p_uploaded_by?: string
        }
        Returns: number
      }
      dossier_approval: {
        Args: { p_prd: number; p_product?: string; p_repo: string }
        Returns: Json
      }
      dossier_approve: { Args: { p_dossier: string }; Returns: Json }
      dossier_link_repositories: {
        Args: { p_dossier: string }
        Returns: undefined
      }
      dossier_list: {
        Args: { p_dossier?: string; p_kind?: string; p_workspace?: string }
        Returns: {
          answered: number
          asked: number
          created_at: string
          home_repo: string
          id: string
          kind: string
          last_activity: string
          latest: Json
          numbered_at: string
          opened_by: string
          prd: number
          repos: string[]
          title: string
          workspace_id: string
        }[]
      }
      dossier_open: {
        Args: { p_claude_session_id?: string; p_repo: string; p_title: string }
        Returns: string
      }
      dossier_push: {
        Args: {
          p_artifacts: Json
          p_draft: string
          p_kind?: string
          p_prd: number
          p_product?: string
          p_product_key?: string
          p_repo: string
          p_title: string
        }
        Returns: Json
      }
      dossier_repos: {
        Args: { p_dossier: string }
        Returns: {
          answered: number
          asked: number
          id: string
          latest: Json
          repos: string[]
        }[]
      }
      dossier_rounds: {
        Args: { p_dossier: string }
        Returns: {
          answered_at: string
          answered_by: string
          answered_via: string
          answers: Json
          asked_by: string
          branch: string
          category: string
          category_by: string
          created_at: string
          prd: number
          questions: Json
          repo: string
          round_id: string
          rule: string
          session_id: string
          skill: string
          status: string
        }[]
      }
      dossier_set_product: {
        Args: { p_dossier: string; p_product: string }
        Returns: Json
      }
      dossier_takes: {
        Args: { p_dossier_kind: string; p_version_kind: string }
        Returns: boolean
      }
      dossier_write_targets: { Args: { p_dossier: string }; Returns: string[] }
      fix_bug_push: {
        Args: { p_body: Json; p_bug: number; p_key: string; p_repo?: string }
        Returns: Json
      }
      fix_row_stamp: {
        Args: {
          p_at: string
          p_bug?: string
          p_event: string
          p_pull: number
          p_repo: string
        }
        Returns: Json
      }
      fix_rows_pull: { Args: { p_dossier: string }; Returns: Json }
      fix_rows_summary: { Args: { p_dossier: string }; Returns: Json }
      fleet_look: {
        Args: {
          p_color: string
          p_label: string
          p_mascot: string
          p_motto: string
        }
        Returns: Record<string, unknown>
      }
      fleet_mascots: { Args: never; Returns: string[] }
      fleet_owner_only: { Args: { p_workspace: string }; Returns: undefined }
      fleet_room: { Args: { p_workspace: string }; Returns: undefined }
      game_answered_rounds: {
        Args: { since: string; workspace: string }
        Returns: {
          answered_at: string
          home: string
          login: string
          prd: number
          round_id: string
        }[]
      }
      has_workspace: { Args: never; Returns: boolean }
      hook_before_user_created: { Args: { event: Json }; Returns: Json }
      idea_votable: { Args: { p_idea: string }; Returns: boolean }
      ideas_board: { Args: { p_full_name: string }; Returns: Json }
      ideas_public_board: {
        Args: { p_repo: string; p_workspace: string }
        Returns: boolean
      }
      is_member: { Args: { workspace: string }; Returns: boolean }
      is_owner: { Args: { workspace: string }; Returns: boolean }
      jev_decision_names: { Args: never; Returns: string[] }
      jev_key_status: {
        Args: { p_workspace: string }
        Returns: {
          last_four: string
          set_at: string
          stored: boolean
        }[]
      }
      jev_owner_only: { Args: { p_workspace: string }; Returns: undefined }
      join_workspaces_by_github: {
        Args: { p_logins: string[]; p_user_id: string }
        Returns: string[]
      }
      kart_grid_allows: { Args: { p_topic: string }; Returns: boolean }
      kit_token_claim: { Args: { p_hash: string }; Returns: Json }
      kit_token_make: {
        Args: {
          p_days: number
          p_hash: string
          p_last_four: string
          p_name: string
          p_session: string
          p_workspace: string
        }
        Returns: Json
      }
      kit_token_release: {
        Args: { p_lease: string; p_token: string }
        Returns: undefined
      }
      kit_token_renewed: {
        Args: { p_lease: string; p_session: string; p_token: string }
        Returns: boolean
      }
      kit_tokens_mine: { Args: { p_workspace: string }; Returns: Json }
      knowledge_graph_for_token: {
        Args: { p_hash: string; p_repo?: string }
        Returns: Json
      }
      knowledge_graph_push: {
        Args: { p_graph: Json; p_repo: string; p_sha: string }
        Returns: Json
      }
      knowledge_pack_for_token: {
        Args: { p_hash: string; p_repo: string; p_sha?: string }
        Returns: Json
      }
      knowledge_pack_put: {
        Args: {
          p_committed_at: string
          p_files: Json
          p_repo: string
          p_sha: string
        }
        Returns: Json
      }
      knowledge_product_for_repo: {
        Args: { p_product?: string; p_repo: string }
        Returns: Json
      }
      link_github: { Args: never; Returns: Json }
      lookup_product: {
        Args: { p_prd?: number; p_repo: string; p_workspace: string }
        Returns: string
      }
      loop_is_silent: {
        Args: { at: string; l: Database["public"]["Tables"]["loops"]["Row"] }
        Returns: boolean
      }
      loop_push: {
        Args: { p_body?: Json; p_event: string; p_loop?: string }
        Returns: Json
      }
      member_login: {
        Args: { p_user: string; p_workspace: string }
        Returns: string
      }
      my_github: {
        Args: never
        Returns: {
          github_id: number
          github_login: string
        }[]
      }
      my_workspaces: { Args: never; Returns: string[] }
      outbox_item_adopt: {
        Args: {
          p_bears_on: string
          p_body: string
          p_item: string
          p_prd: number
          p_product: string
          p_raised: string
          p_rank: string
          p_repository?: string
          p_slice: string
          p_wave: number
        }
        Returns: Json
      }
      outbox_item_of: {
        Args: {
          p_bears_on: string
          p_body: string
          p_dossier: string
          p_item: string
          p_raised: string
          p_rank: string
          p_repository: string
          p_slice: string
          p_wave: number
        }
        Returns: {
          bears_on: string
          body: string
          dossier_id: string
          id: string
          item: string
          raised: string
          raised_at: string
          raised_by: string
          rank: string
          repository: string | null
          slice: string
          updated_at: string
          wave: number
        }
        SetofOptions: {
          from: "*"
          to: "outbox_items"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      outbox_item_put: {
        Args: {
          p_bears_on: string
          p_body: string
          p_item: string
          p_prd: number
          p_product: string
          p_raised: string
          p_rank: string
          p_repository?: string
          p_slice: string
          p_wave: number
        }
        Returns: Json
      }
      outbox_prd_of: {
        Args: { p_prd: number; p_product: string; p_repo: string }
        Returns: {
          birthplace: string | null
          claude_session_id: string | null
          created_at: string
          home_repo: string | null
          id: string
          kind: string
          numbered_at: string | null
          opened_by: string | null
          prd: number | null
          product_id: string | null
          product_seq: number | null
          title: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "dossiers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      outbox_send_done: {
        Args: {
          p_comment_url?: string
          p_counted?: boolean
          p_error?: string
          p_login?: string
          p_send: string
        }
        Returns: undefined
      }
      outbox_settle: {
        Args: {
          p_answer: string
          p_basis: string
          p_channel: string
          p_item: string
          p_prd: number
          p_product: string
          p_repo?: string
          p_verdict: string
        }
        Returns: Json
      }
      persona_add: {
        Args: {
          p_avatar: Json
          p_name: string
          p_product: string
          p_stance: string
          p_trade: string
          p_usage: string
          p_who: string
          p_workspace: string
        }
        Returns: {
          avatar: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          ordinal: number
          product_id: string
          stance: string
          trade: string
          updated_at: string
          usage: string
          who: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "personas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      persona_delete: {
        Args: { p_persona: string; p_workspace: string }
        Returns: {
          avatar: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          ordinal: number
          product_id: string
          stance: string
          trade: string
          updated_at: string
          usage: string
          who: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "personas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      persona_edit: {
        Args: {
          p_avatar: Json
          p_name: string
          p_persona: string
          p_stance: string
          p_trade: string
          p_usage: string
          p_who: string
          p_workspace: string
        }
        Returns: {
          avatar: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          ordinal: number
          product_id: string
          stance: string
          trade: string
          updated_at: string
          usage: string
          who: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "personas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      persona_fields: {
        Args: {
          p_avatar: Json
          p_name: string
          p_stance: string
          p_trade: string
          p_usage: string
          p_who: string
        }
        Returns: Record<string, unknown>
      }
      persona_of: {
        Args: { p_deleted: boolean; p_persona: string; p_workspace: string }
        Returns: {
          avatar: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          ordinal: number
          product_id: string
          stance: string
          trade: string
          updated_at: string
          usage: string
          who: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "personas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      persona_restore: {
        Args: { p_persona: string; p_workspace: string }
        Returns: {
          avatar: Json
          created_at: string
          created_by: string | null
          deleted_at: string | null
          id: string
          name: string
          ordinal: number
          product_id: string
          stance: string
          trade: string
          updated_at: string
          usage: string
          who: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "personas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      pitch_asset_product: { Args: { path: string }; Returns: string }
      pitch_dossier_shipped: { Args: { p_dossier: string }; Returns: boolean }
      pitch_files: { Args: never; Returns: string[] }
      pitch_from_look: { Args: { p_look: string }; Returns: Json }
      pitch_look_for_repo: {
        Args: { p_prd?: number; p_repo: string }
        Returns: string
      }
      pitch_path_dossier: { Args: { path: string }; Returns: string }
      pitch_path_run: { Args: { path: string }; Returns: string }
      pitch_refusal: { Args: { p_pitch: Json }; Returns: string }
      pitch_run_add: {
        Args: {
          p_audience: string
          p_benefit: string
          p_closing: string
          p_commit: string
          p_dossier: string
          p_files: string[]
          p_hook: string
          p_kicker: string
          p_look: string
          p_run: string
        }
        Returns: string
      }
      pitch_settings_for_repo: {
        Args: { p_prd?: number; p_repo: string }
        Returns: Json
      }
      plan_repository_names: { Args: { p_plan: string }; Returns: string[] }
      plan_slice_count: { Args: { p_plan: string }; Returns: number }
      prd_dossier: {
        Args: { p_prd: number; p_product?: string; p_repo: string }
        Returns: {
          birthplace: string | null
          claude_session_id: string | null
          created_at: string
          home_repo: string | null
          id: string
          kind: string
          numbered_at: string | null
          opened_by: string | null
          prd: number | null
          product_id: string | null
          product_seq: number | null
          title: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "dossiers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      prd_id_of: { Args: { p_product: string; p_seq: number }; Returns: string }
      prd_targets_backfill: { Args: never; Returns: number }
      product_add: {
        Args: { p_name: string; p_workspace: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          bug_seq: number
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          key: string | null
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
          plan_repository: string | null
          prd_count: number
          roadmap_seq: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_approver_remove: {
        Args: { p_member: string; p_product: string }
        Returns: boolean
      }
      product_approver_set: {
        Args: { p_member: string; p_product: string; p_state: string }
        Returns: Json
      }
      product_archive: { Args: { p_product: string }; Returns: Json }
      product_archived_for: {
        Args: { p_prd?: number; p_repo: string; p_workspace: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          bug_seq: number
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          key: string | null
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
          plan_repository: string | null
          prd_count: number
          roadmap_seq: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_glossary_add: {
        Args: {
          p_avoid?: string[]
          p_meaning: string
          p_product: string
          p_term: string
          p_workspace: string
        }
        Returns: {
          avoid: string[]
          created_at: string
          created_by: string | null
          id: string
          meaning: string
          product_id: string
          removed_at: string | null
          removed_by: string | null
          term: string
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "product_glossary"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_glossary_edit: {
        Args: {
          p_avoid?: string[]
          p_entry: string
          p_meaning?: string
          p_term?: string
          p_workspace: string
        }
        Returns: {
          avoid: string[]
          created_at: string
          created_by: string | null
          id: string
          meaning: string
          product_id: string
          removed_at: string | null
          removed_by: string | null
          term: string
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "product_glossary"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_glossary_fields: {
        Args: { e: Database["public"]["Tables"]["product_glossary"]["Row"] }
        Returns: Json
      }
      product_glossary_live: {
        Args: { p_entry: string; p_product: string; p_workspace: string }
        Returns: {
          avoid: string[]
          created_at: string
          created_by: string | null
          id: string
          meaning: string
          product_id: string
          removed_at: string | null
          removed_by: string | null
          term: string
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "product_glossary"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_glossary_remove: {
        Args: { p_entry: string; p_workspace: string }
        Returns: {
          avoid: string[]
          created_at: string
          created_by: string | null
          id: string
          meaning: string
          product_id: string
          removed_at: string | null
          removed_by: string | null
          term: string
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "product_glossary"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_glossary_unique: {
        Args: { p_except: string; p_product: string; p_term: string }
        Returns: undefined
      }
      product_knowledge_apply: {
        Args: {
          p_action: string
          p_entry: string
          p_fields: Json
          p_kind: string
          p_owner: string
          p_product: Database["public"]["Tables"]["products"]["Row"]
        }
        Returns: Json
      }
      product_knowledge_approve: {
        Args: { p_proposal: string; p_workspace: string }
        Returns: {
          action: string
          decided_at: string | null
          decided_by: string | null
          fields: Json
          glossary_id: string | null
          id: string
          kind: string
          legal_id: string | null
          product_id: string
          proposed_at: string
          proposed_by: string | null
          state: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "product_knowledge_proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_knowledge_change: {
        Args: {
          p_action: string
          p_entry: string
          p_event: string
          p_fields: Json
          p_kind: string
          p_product: Database["public"]["Tables"]["products"]["Row"]
        }
        Returns: string
      }
      product_knowledge_decider_only: {
        Args: { p_kind: string; p_product: string }
        Returns: undefined
      }
      product_knowledge_decides: {
        Args: { p_kind: string; p_product: string }
        Returns: boolean
      }
      product_knowledge_entry_product: {
        Args: { p_entry: string; p_kind: string; p_workspace: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          bug_seq: number
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          key: string | null
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
          plan_repository: string | null
          prd_count: number
          roadmap_seq: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_knowledge_fields: {
        Args: {
          p_action: string
          p_fields: Json
          p_kind: string
          p_owner: string
          p_workspace: string
        }
        Returns: Json
      }
      product_knowledge_for_agents: {
        Args: { p_product: string }
        Returns: Json
      }
      product_knowledge_kind: { Args: { p_kind: string }; Returns: string }
      product_knowledge_log: {
        Args: {
          p_action: string
          p_after: Json
          p_before: Json
          p_entry: string
          p_kind: string
          p_product: Database["public"]["Tables"]["products"]["Row"]
          p_proposal: string
        }
        Returns: undefined
      }
      product_knowledge_member_only: {
        Args: { p_workspace: string }
        Returns: undefined
      }
      product_knowledge_name: {
        Args: {
          p_kind: string
          p_product: string
          p_role: string
          p_user: string
          p_workspace: string
        }
        Returns: Json
      }
      product_knowledge_named: {
        Args: { p_kind: string; p_product: string }
        Returns: {
          kind: string
          named_at: string
          named_by: string | null
          product_id: string
          role: string
          user_id: string
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "product_knowledge_owners"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      product_knowledge_of: {
        Args: { p_product: string; p_workspace: string }
        Returns: Json
      }
      product_knowledge_open: {
        Args: { p_proposal: string; p_workspace: string }
        Returns: {
          action: string
          decided_at: string | null
          decided_by: string | null
          fields: Json
          glossary_id: string | null
          id: string
          kind: string
          legal_id: string | null
          product_id: string
          proposed_at: string
          proposed_by: string | null
          state: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "product_knowledge_proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_knowledge_person: {
        Args: { p_user: string; p_workspace: string }
        Returns: Json
      }
      product_knowledge_product: {
        Args: { p_product: string; p_workspace: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          bug_seq: number
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          key: string | null
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
          plan_repository: string | null
          prd_count: number
          roadmap_seq: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_knowledge_propose: {
        Args: {
          p_action: string
          p_entry?: string
          p_fields?: Json
          p_kind: string
          p_product: string
          p_workspace: string
        }
        Returns: {
          action: string
          decided_at: string | null
          decided_by: string | null
          fields: Json
          glossary_id: string | null
          id: string
          kind: string
          legal_id: string | null
          product_id: string
          proposed_at: string
          proposed_by: string | null
          state: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "product_knowledge_proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_knowledge_reject: {
        Args: { p_proposal: string; p_workspace: string }
        Returns: {
          action: string
          decided_at: string | null
          decided_by: string | null
          fields: Json
          glossary_id: string | null
          id: string
          kind: string
          legal_id: string | null
          product_id: string
          proposed_at: string
          proposed_by: string | null
          state: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "product_knowledge_proposals"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_knowledge_text: {
        Args: {
          p_field: string
          p_label: string
          p_most: number
          p_value: string
        }
        Returns: string
      }
      product_legal_add: {
        Args: {
          p_code: string
          p_owner?: string
          p_product: string
          p_source: string
          p_statement: string
          p_workspace: string
        }
        Returns: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          number: number
          owner_id: string | null
          product_id: string
          retired_at: string | null
          retired_by: string | null
          source: string
          statement: string
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "product_legal"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_legal_edit: {
        Args: {
          p_entry: string
          p_owner?: string
          p_source?: string
          p_statement?: string
          p_workspace: string
        }
        Returns: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          number: number
          owner_id: string | null
          product_id: string
          retired_at: string | null
          retired_by: string | null
          source: string
          statement: string
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "product_legal"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_legal_fields: {
        Args: { e: Database["public"]["Tables"]["product_legal"]["Row"] }
        Returns: Json
      }
      product_legal_live: {
        Args: { p_entry: string; p_product: string; p_workspace: string }
        Returns: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          number: number
          owner_id: string | null
          product_id: string
          retired_at: string | null
          retired_by: string | null
          source: string
          statement: string
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "product_legal"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_legal_retire: {
        Args: { p_entry: string; p_workspace: string }
        Returns: {
          code: string
          created_at: string
          created_by: string | null
          id: string
          number: number
          owner_id: string | null
          product_id: string
          retired_at: string | null
          retired_by: string | null
          source: string
          statement: string
          updated_at: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "product_legal"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_live: {
        Args: { p: Database["public"]["Tables"]["products"]["Row"] }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          bug_seq: number
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          key: string | null
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
          plan_repository: string | null
          prd_count: number
          roadmap_seq: number
          workspace_id: string
        }
        SetofOptions: {
          from: "products"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_of_key: {
        Args: { p_key: string; p_repo?: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          bug_seq: number
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          key: string | null
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
          plan_repository: string | null
          prd_count: number
          roadmap_seq: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_owner_of: {
        Args: { p_act: string; p_product: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          bug_seq: number
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          key: string | null
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
          plan_repository: string | null
          prd_count: number
          roadmap_seq: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_plan_repository_set: {
        Args: { p_product: string; p_repository: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          bug_seq: number
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          key: string | null
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
          plan_repository: string | null
          prd_count: number
          roadmap_seq: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_prd_ids_rollback_guard: { Args: never; Returns: undefined }
      product_rename: {
        Args: { p_name: string; p_product: string; p_workspace: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          bug_seq: number
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          key: string | null
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
          plan_repository: string | null
          prd_count: number
          roadmap_seq: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_repository_link: {
        Args: {
          p_consumes?: string[]
          p_knowledge?: string
          p_product: string
          p_read_at?: string
          p_read_only?: boolean
          p_repository: string
          p_role?: string
        }
        Returns: {
          added_at: string
          added_by: string
          consumes: string[]
          knowledge: string
          ladder_step: number
          product_id: string
          read_at: string | null
          read_only: boolean
          repository: string
          role: string | null
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "product_repositories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_repository_owned: {
        Args: { p_product: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          bug_seq: number
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          key: string | null
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
          plan_repository: string | null
          prd_count: number
          roadmap_seq: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_repository_set_step: {
        Args: { p_product: string; p_repository: string; p_step: number }
        Returns: {
          added_at: string
          added_by: string
          consumes: string[]
          knowledge: string
          ladder_step: number
          product_id: string
          read_at: string | null
          read_only: boolean
          repository: string
          role: string | null
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "product_repositories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_repository_unlink: {
        Args: { p_product: string; p_repository: string }
        Returns: boolean
      }
      product_restore: { Args: { p_product: string }; Returns: Json }
      product_set_key: {
        Args: { p_key: string; p_product: string }
        Returns: Json
      }
      proof_criteria_valid: { Args: { c: Json }; Returns: boolean }
      proof_file_name_valid: { Args: { name: string }; Returns: boolean }
      proof_path_dossier: { Args: { path: string }; Returns: string }
      proof_path_run: { Args: { path: string }; Returns: string }
      proof_run_add: {
        Args: {
          p_commit: string
          p_criteria: Json
          p_dossier: string
          p_gif?: string
          p_run: string
          p_url: string
        }
        Returns: string
      }
      remove_jev_key: { Args: { p_workspace: string }; Returns: undefined }
      remove_repository: {
        Args: { p_full_name: string; p_workspace: string }
        Returns: {
          added_at: string
          added_by: string | null
          collect_error: string | null
          collected_at: string | null
          collected_until: string | null
          fix_when_answered: boolean
          full_name: string
          phase0: string
          public_ideas: boolean
          removed_at: string | null
          tracked: boolean
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "repositories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      repo_workspace: {
        Args: { person: string; repo: string }
        Returns: Record<string, unknown>
      }
      repository_only_product: {
        Args: { p_repo: string; p_workspace: string }
        Returns: string
      }
      repository_owner_only: {
        Args: { p_workspace: string }
        Returns: undefined
      }
      repository_phase0: { Args: { p_repo: string }; Returns: string }
      repository_runner_skills_of: {
        Args: { p_full_name: string; p_workspace: string }
        Returns: string[]
      }
      restore_fleet: {
        Args: { p_name: string; p_workspace: string }
        Returns: {
          color: string
          home: string | null
          label: string
          mascot: string | null
          motto: string
          name: string
          project_note: string | null
          project_noted_at: string | null
          project_url: string | null
          retired_at: string | null
          sort: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "teams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      retire_fleet: {
        Args: { p_name: string; p_workspace: string }
        Returns: {
          color: string
          home: string | null
          label: string
          mascot: string | null
          motto: string
          name: string
          project_note: string | null
          project_noted_at: string | null
          project_url: string | null
          retired_at: string | null
          sort: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "teams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rewind_evidence_ok: { Args: { p_evidence: Json }; Returns: boolean }
      rewind_finding_approve: {
        Args: { p_finding: string; p_workspace: string }
        Returns: {
          check_name: string
          decided_at: string | null
          decided_by: string | null
          evidence: Json
          fix: string
          happened: string
          id: string
          origin: string
          prd: number
          proposed_at: string
          reason: string | null
          repository: string
          state: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "rewind_findings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rewind_finding_open: {
        Args: { p_finding: string; p_workspace: string }
        Returns: {
          check_name: string
          decided_at: string | null
          decided_by: string | null
          evidence: Json
          fix: string
          happened: string
          id: string
          origin: string
          prd: number
          proposed_at: string
          reason: string | null
          repository: string
          state: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "rewind_findings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      rewind_finding_reject: {
        Args: { p_finding: string; p_reason?: string; p_workspace: string }
        Returns: {
          check_name: string
          decided_at: string | null
          decided_by: string | null
          evidence: Json
          fix: string
          happened: string
          id: string
          origin: string
          prd: number
          proposed_at: string
          reason: string | null
          repository: string
          state: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "rewind_findings"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      roadmap_human_work_claim: {
        Args: { p_limit: number; p_roadmap: string }
        Returns: Json
      }
      roadmap_human_work_set_kind: {
        Args: { p_key: string; p_kind: string; p_roadmap: string }
        Returns: boolean
      }
      roadmap_id_of: {
        Args: { p_product: string; p_seq: number }
        Returns: string
      }
      roadmap_prerequisites_push: { Args: { p_body: Json }; Returns: Json }
      roadmap_product_push: {
        Args: {
          p_body: Json
          p_key: string
          p_repo?: string
          p_roadmap: number
        }
        Returns: Json
      }
      roadmap_push: { Args: { p_body: Json }; Returns: Json }
      runner_claim: {
        Args: { p_runner: string }
        Returns: {
          acting_for: string | null
          cancel_requested: boolean
          cancelled_by_key: string | null
          cancelled_for: string | null
          claimed_at: string | null
          continues: string | null
          ended_at: string | null
          exit_code: number | null
          fixed_by: string | null
          follow_ups: Json
          id: string
          line: string
          log_tail: string
          notify_url: string | null
          outcome: string | null
          pr_url: string | null
          prs: Json
          queued_at: string
          reason: string | null
          release_error: string | null
          released: number[] | null
          repo: string
          runner_id: string | null
          running_at: string | null
          sent_by: string | null
          sent_by_app: string | null
          sent_by_key: string | null
          slices_merged: number | null
          slices_total: number | null
          status: string
          to_fleet: string | null
          to_runner: string | null
          tokens: Json | null
          workspace_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "runner_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      runner_job_answer: {
        Args: {
          p_acting_for?: string
          p_answers: Json
          p_by?: string
          p_job: string
          p_key?: string
        }
        Returns: {
          acting_for: string | null
          cancel_requested: boolean
          cancelled_by_key: string | null
          cancelled_for: string | null
          claimed_at: string | null
          continues: string | null
          ended_at: string | null
          exit_code: number | null
          fixed_by: string | null
          follow_ups: Json
          id: string
          line: string
          log_tail: string
          notify_url: string | null
          outcome: string | null
          pr_url: string | null
          prs: Json
          queued_at: string
          reason: string | null
          release_error: string | null
          released: number[] | null
          repo: string
          runner_id: string | null
          running_at: string | null
          sent_by: string | null
          sent_by_app: string | null
          sent_by_key: string | null
          slices_merged: number | null
          slices_total: number | null
          status: string
          to_fleet: string | null
          to_runner: string | null
          tokens: Json | null
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "runner_jobs"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      runner_job_closer_check: {
        Args: {
          p_acting_for: string
          p_by: string
          p_job_key: string
          p_key: string
          p_repo: string
          p_workspace: string
        }
        Returns: undefined
      }
      runner_job_dismiss: {
        Args: {
          p_acting_for?: string
          p_by?: string
          p_job: string
          p_key?: string
        }
        Returns: {
          answers: Json | null
          asked_at: string
          closed_at: string | null
          closed_by: string | null
          closed_by_key: string | null
          closed_for: string | null
          issue: number
          job_id: string
          lead: string
          questions: Json
          resume_job: string | null
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "runner_job_questions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      runner_job_lines_retain: {
        Args: { p_keep: number; p_workspace: string }
        Returns: number
      }
      runners_mark_lost: { Args: { p_cutoff: string }; Returns: number }
      set_fleet_project: {
        Args: { p_name: string; p_url: string; p_workspace: string }
        Returns: {
          color: string
          home: string | null
          label: string
          mascot: string | null
          motto: string
          name: string
          project_note: string | null
          project_noted_at: string | null
          project_url: string | null
          retired_at: string | null
          sort: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "teams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_jev_decision: {
        Args: {
          p_decision: string
          p_floor: number
          p_mode: string
          p_threshold: number
          p_workspace: string
        }
        Returns: {
          confidence_floor: number
          decision: string
          mode: string
          threshold: number
          updated_at: string
          updated_by: string | null
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "jev_decisions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_jev_key: {
        Args: {
          p_ciphertext: string
          p_iv: string
          p_last_four: string
          p_workspace: string
        }
        Returns: {
          last_four: string
          set_at: string
        }[]
      }
      set_pitch_look: {
        Args: { p_look: string; p_product: string; p_workspace: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          bug_seq: number
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          key: string | null
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
          plan_repository: string | null
          prd_count: number
          roadmap_seq: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_pitch_settings: {
        Args: { p_pitch: Json; p_product: string; p_workspace: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          bug_seq: number
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          key: string | null
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
          plan_repository: string | null
          prd_count: number
          roadmap_seq: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_repository_fix_when_answered: {
        Args: { p_full_name: string; p_on: boolean; p_workspace: string }
        Returns: {
          added_at: string
          added_by: string | null
          collect_error: string | null
          collected_at: string | null
          collected_until: string | null
          fix_when_answered: boolean
          full_name: string
          phase0: string
          public_ideas: boolean
          removed_at: string | null
          tracked: boolean
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "repositories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_repository_phase0: {
        Args: { p_full_name: string; p_phase0: string; p_workspace: string }
        Returns: {
          added_at: string
          added_by: string | null
          collect_error: string | null
          collected_at: string | null
          collected_until: string | null
          fix_when_answered: boolean
          full_name: string
          phase0: string
          public_ideas: boolean
          removed_at: string | null
          tracked: boolean
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "repositories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_repository_public_ideas: {
        Args: { p_full_name: string; p_public: boolean; p_workspace: string }
        Returns: {
          added_at: string
          added_by: string | null
          collect_error: string | null
          collected_at: string | null
          collected_until: string | null
          fix_when_answered: boolean
          full_name: string
          phase0: string
          public_ideas: boolean
          removed_at: string | null
          tracked: boolean
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "repositories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_repository_runner_skill: {
        Args: {
          p_allowed: boolean
          p_full_name: string
          p_skill: string
          p_workspace: string
        }
        Returns: undefined
      }
      set_repository_tracked: {
        Args: { p_full_name: string; p_tracked: boolean; p_workspace: string }
        Returns: {
          added_at: string
          added_by: string | null
          collect_error: string | null
          collected_at: string | null
          collected_until: string | null
          fix_when_answered: boolean
          full_name: string
          phase0: string
          public_ideas: boolean
          removed_at: string | null
          tracked: boolean
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "repositories"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_workspace_settings_repository: {
        Args: { p_full_name: string; p_workspace: string }
        Returns: {
          created_at: string
          game_since: string
          github_account_type: string | null
          github_installation_id: number | null
          github_org: string | null
          id: string
          name: string
          plan_repo: string | null
          settings_repository: string | null
          slug: string
          theme: Json
        }
        SetofOptions: {
          from: "*"
          to: "workspaces"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      spec_says_server: { Args: { p_content: string }; Returns: boolean }
      submit_score: {
        Args: { game: string; score: number; workspace: string }
        Returns: number
      }
      update_fleet: {
        Args: {
          p_color: string
          p_label: string
          p_mascot?: string
          p_motto?: string
          p_name: string
          p_workspace: string
        }
        Returns: {
          color: string
          home: string | null
          label: string
          mascot: string | null
          motto: string
          name: string
          project_note: string | null
          project_noted_at: string | null
          project_url: string | null
          retired_at: string | null
          sort: number
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "teams"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      valid_hero: { Args: { h: Json }; Returns: boolean }
      valid_persona_avatar: { Args: { p_avatar: Json }; Returns: boolean }
      valid_theme: { Args: { t: Json }; Returns: boolean }
      working_ping: {
        Args: {
          p_claude_session_id: string
          p_draft?: string
          p_ended?: boolean
          p_repo: string
          p_work_kind?: string
          p_work_number?: number
        }
        Returns: undefined
      }
      workspace_roster: {
        Args: { workspace: string }
        Returns: {
          avatar_url: string
          fleet: string
          github_login: string
          hero: Json
          name: string
          user_id: string
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

