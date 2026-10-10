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
          id: string
          last_four: string
          last_used_at: string | null
          made_by: string
          name: string
          revoked_at: string | null
          revoked_by: string | null
          token_hash: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_four: string
          last_used_at?: string | null
          made_by: string
          name: string
          revoked_at?: string | null
          revoked_by?: string | null
          token_hash: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_four?: string
          last_used_at?: string | null
          made_by?: string
          name?: string
          revoked_at?: string | null
          revoked_by?: string | null
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
          home_repo: string
          id: string
          kind: string
          numbered_at: string | null
          opened_by: string | null
          prd: number | null
          product_id: string | null
          title: string
          workspace_id: string
        }
        Insert: {
          birthplace?: string | null
          claude_session_id?: string | null
          created_at?: string
          home_repo: string
          id?: string
          kind?: string
          numbered_at?: string | null
          opened_by?: string | null
          prd?: number | null
          product_id?: string | null
          title: string
          workspace_id: string
        }
        Update: {
          birthplace?: string | null
          claude_session_id?: string | null
          created_at?: string
          home_repo?: string
          id?: string
          kind?: string
          numbered_at?: string | null
          opened_by?: string | null
          prd?: number | null
          product_id?: string | null
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
      product_repositories: {
        Row: {
          added_at: string
          added_by: string
          consumes: string[]
          knowledge: string
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
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
          workspace_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          ordinal?: never
          pitch?: Json
          pitch_look?: string
          workspace_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          ordinal?: never
          pitch?: Json
          pitch_look?: string
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
          full_name: string
          phase0: string
          public_ideas: boolean
          tracked: boolean
          workspace_id: string
        }
        Insert: {
          added_at?: string
          added_by?: string | null
          collect_error?: string | null
          collected_at?: string | null
          collected_until?: string | null
          full_name: string
          phase0?: string
          public_ideas?: boolean
          tracked?: boolean
          workspace_id: string
        }
        Update: {
          added_at?: string
          added_by?: string | null
          collect_error?: string | null
          collected_at?: string | null
          collected_until?: string | null
          full_name?: string
          phase0?: string
          public_ideas?: boolean
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
          prd: number
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
          prd: number
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
          prd?: number
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
          id: string
          milestone: string
          number: number
          prerequisites_checked_at: string | null
          prerequisites_machine: string | null
          product_id: string | null
          pushed_at: string
          pushed_by: string | null
          questions: Json
          repo: string
          source: string | null
          target_date: string | null
          title: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          document: string
          id?: string
          milestone: string
          number: number
          prerequisites_checked_at?: string | null
          prerequisites_machine?: string | null
          product_id?: string | null
          pushed_at?: string
          pushed_by?: string | null
          questions?: Json
          repo: string
          source?: string | null
          target_date?: string | null
          title: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          document?: string
          id?: string
          milestone?: string
          number?: number
          prerequisites_checked_at?: string | null
          prerequisites_machine?: string | null
          product_id?: string | null
          pushed_at?: string
          pushed_by?: string | null
          questions?: Json
          repo?: string
          source?: string | null
          target_date?: string | null
          title?: string
          workspace_id?: string
        }
        Relationships: [
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
          full_name: string
          phase0: string
          public_ideas: boolean
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
          id: string
          last_four: string
          last_used_at: string | null
          made_by: string
          name: string
          revoked_at: string | null
          revoked_by: string | null
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
      answered_counts: {
        Args: { from_at: string; to_at: string; workspace: string }
        Returns: {
          answered: number
          user_id: string
        }[]
      }
      approval_people: { Args: { p_dossier: string }; Returns: Json }
      approval_recipients: { Args: { p_request: string }; Returns: Json }
      approval_request: {
        Args: { p_prd: number; p_repo: string }
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
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
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
        Args: { p_prd: number; p_repo: string }
        Returns: Json
      }
      dossier_approve: { Args: { p_dossier: string }; Returns: Json }
      dossier_link_repositories: {
        Args: { p_dossier: string }
        Returns: undefined
      }
      dossier_list: {
        Args: { p_dossier?: string; p_workspace?: string }
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
          p_repo: string
          p_title: string
        }
        Returns: Json
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
      product_add: {
        Args: { p_name: string; p_workspace: string }
        Returns: {
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
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
      product_rename: {
        Args: { p_name: string; p_product: string; p_workspace: string }
        Returns: {
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
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
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      product_repository_unlink: {
        Args: { p_product: string; p_repository: string }
        Returns: boolean
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
      restore_fleet: {
        Args: { p_name: string; p_workspace: string }
        Returns: {
          color: string
          home: string | null
          label: string
          mascot: string | null
          motto: string
          name: string
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
      roadmap_human_work_claim: {
        Args: { p_limit: number; p_roadmap: string }
        Returns: Json
      }
      roadmap_human_work_set_kind: {
        Args: { p_key: string; p_kind: string; p_roadmap: string }
        Returns: boolean
      }
      roadmap_prerequisites_push: { Args: { p_body: Json }; Returns: Json }
      roadmap_push: { Args: { p_body: Json }; Returns: Json }
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
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
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
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          ordinal: number
          pitch: Json
          pitch_look: string
          workspace_id: string
        }
        SetofOptions: {
          from: "*"
          to: "products"
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
          full_name: string
          phase0: string
          public_ideas: boolean
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
          full_name: string
          phase0: string
          public_ideas: boolean
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
      set_repository_tracked: {
        Args: { p_full_name: string; p_tracked: boolean; p_workspace: string }
        Returns: {
          added_at: string
          added_by: string | null
          collect_error: string | null
          collected_at: string | null
          collected_until: string | null
          full_name: string
          phase0: string
          public_ideas: boolean
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

