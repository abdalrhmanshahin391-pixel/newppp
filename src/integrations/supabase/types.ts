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
      _mig_log: {
        Row: {
          at: string | null
          chunk: string | null
          err: string | null
          id: number
        }
        Insert: {
          at?: string | null
          chunk?: string | null
          err?: string | null
          id?: number
        }
        Update: {
          at?: string | null
          chunk?: string | null
          err?: string | null
          id?: number
        }
        Relationships: []
      }
      admin_ai_keys: {
        Row: {
          api_key: string
          preferred_model: string | null
          provider: string
          purpose: string
          slot: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          api_key: string
          preferred_model?: string | null
          provider: string
          purpose?: string
          slot?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          api_key?: string
          preferred_model?: string | null
          provider?: string
          purpose?: string
          slot?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      admin_ai_model_limits: {
        Row: {
          api_model_id: string | null
          cooldown_seconds: number
          created_at: string
          enabled: boolean
          label: string
          last_error: string | null
          last_error_at: string | null
          max_concurrent: number
          model_id: string
          rpd: number
          rpm: number
          smooth_pacing: boolean
          sort_order: number
          supports_vision: boolean
          updated_at: string
          updated_by: string | null
          use_json_mime: boolean
        }
        Insert: {
          api_model_id?: string | null
          cooldown_seconds?: number
          created_at?: string
          enabled?: boolean
          label: string
          last_error?: string | null
          last_error_at?: string | null
          max_concurrent?: number
          model_id: string
          rpd?: number
          rpm?: number
          smooth_pacing?: boolean
          sort_order?: number
          supports_vision?: boolean
          updated_at?: string
          updated_by?: string | null
          use_json_mime?: boolean
        }
        Update: {
          api_model_id?: string | null
          cooldown_seconds?: number
          created_at?: string
          enabled?: boolean
          label?: string
          last_error?: string | null
          last_error_at?: string | null
          max_concurrent?: number
          model_id?: string
          rpd?: number
          rpm?: number
          smooth_pacing?: boolean
          sort_order?: number
          supports_vision?: boolean
          updated_at?: string
          updated_by?: string | null
          use_json_mime?: boolean
        }
        Relationships: []
      }
      admin_data_exports: {
        Row: {
          action: string
          actor_id: string | null
          actor_label: string | null
          created_at: string
          details: Json | null
          id: string
          record_count: number
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          record_count?: number
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_label?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          record_count?: number
        }
        Relationships: []
      }
      admin_hub_layout: {
        Row: {
          created_at: string
          id: boolean
          layout: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: boolean
          layout?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: boolean
          layout?: Json
          updated_at?: string
        }
        Relationships: []
      }
      aio_cards: {
        Row: {
          back: string
          created_at: string
          front: string
          id: string
          lecture_id: string
          sort_order: number
          user_id: string
        }
        Insert: {
          back: string
          created_at?: string
          front: string
          id?: string
          lecture_id: string
          sort_order?: number
          user_id: string
        }
        Update: {
          back?: string
          created_at?: string
          front?: string
          id?: string
          lecture_id?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aio_cards_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lq_lectures"
            referencedColumns: ["id"]
          },
        ]
      }
      aio_summaries: {
        Row: {
          created_at: string
          guide_md: string
          id: string
          lecture_id: string
          short_md: string
          summary_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          guide_md?: string
          id?: string
          lecture_id: string
          short_md?: string
          summary_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          guide_md?: string
          id?: string
          lecture_id?: string
          short_md?: string
          summary_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "aio_summaries_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: true
            referencedRelation: "lq_lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "aio_summaries_summary_id_fkey"
            columns: ["summary_id"]
            isOneToOne: false
            referencedRelation: "summaries"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_audiences: {
        Row: {
          announcement_id: string
          group_id: string
        }
        Insert: {
          announcement_id: string
          group_id: string
        }
        Update: {
          announcement_id?: string
          group_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_audiences_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "site_announcements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "announcement_audiences_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_events: {
        Row: {
          announcement_id: string
          created_at: string
          id: string
          kind: string
          user_id: string | null
        }
        Insert: {
          announcement_id: string
          created_at?: string
          id?: string
          kind: string
          user_id?: string | null
        }
        Update: {
          announcement_id?: string
          created_at?: string
          id?: string
          kind?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcement_events_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcement_seen: {
        Row: {
          announcement_id: string
          clicked: boolean
          last_seen_at: string
          seen_count: number
          user_id: string
        }
        Insert: {
          announcement_id: string
          clicked?: boolean
          last_seen_at?: string
          seen_count?: number
          user_id: string
        }
        Update: {
          announcement_id?: string
          clicked?: boolean
          last_seen_at?: string
          seen_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "announcement_seen_announcement_id_fkey"
            columns: ["announcement_id"]
            isOneToOne: false
            referencedRelation: "site_announcements"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          accent: string | null
          audience: string
          body: string | null
          confetti: boolean
          countdown_to: string | null
          created_at: string
          created_by: string | null
          emoji: string | null
          ends_at: string | null
          eyebrow: string | null
          frequency: string
          id: string
          image_url: string | null
          layout: string
          name: string
          pages: Json
          primary_href: string | null
          primary_label: string | null
          priority: number
          secondary_href: string | null
          secondary_label: string | null
          starts_at: string | null
          status: string
          theme: string
          title: string
          updated_at: string
        }
        Insert: {
          accent?: string | null
          audience?: string
          body?: string | null
          confetti?: boolean
          countdown_to?: string | null
          created_at?: string
          created_by?: string | null
          emoji?: string | null
          ends_at?: string | null
          eyebrow?: string | null
          frequency?: string
          id?: string
          image_url?: string | null
          layout?: string
          name?: string
          pages?: Json
          primary_href?: string | null
          primary_label?: string | null
          priority?: number
          secondary_href?: string | null
          secondary_label?: string | null
          starts_at?: string | null
          status?: string
          theme?: string
          title?: string
          updated_at?: string
        }
        Update: {
          accent?: string | null
          audience?: string
          body?: string | null
          confetti?: boolean
          countdown_to?: string | null
          created_at?: string
          created_by?: string | null
          emoji?: string | null
          ends_at?: string | null
          eyebrow?: string | null
          frequency?: string
          id?: string
          image_url?: string | null
          layout?: string
          name?: string
          pages?: Json
          primary_href?: string | null
          primary_label?: string | null
          priority?: number
          secondary_href?: string | null
          secondary_label?: string | null
          starts_at?: string | null
          status?: string
          theme?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      archive_chunks: {
        Row: {
          attempts: number
          chunk_index: number
          chunk_text: string
          created_at: string
          error: string | null
          id: string
          job_id: string
          page_from: number
          page_to: number
          question_blocks: Json
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          chunk_index: number
          chunk_text?: string
          created_at?: string
          error?: string | null
          id?: string
          job_id: string
          page_from: number
          page_to: number
          question_blocks?: Json
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          chunk_index?: number
          chunk_text?: string
          created_at?: string
          error?: string | null
          id?: string
          job_id?: string
          page_from?: number
          page_to?: number
          question_blocks?: Json
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "archive_chunks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "archive_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      archive_jobs: {
        Row: {
          chunks_done: number
          chunks_total: number
          created_at: string
          error: string | null
          id: string
          lease_until: string | null
          pdf_name: string
          questions_found: number
          questions_solved: number
          status: string
          subject: string
          subtopic: string
          total_pages: number
          updated_at: string
          user_id: string
        }
        Insert: {
          chunks_done?: number
          chunks_total?: number
          created_at?: string
          error?: string | null
          id?: string
          lease_until?: string | null
          pdf_name: string
          questions_found?: number
          questions_solved?: number
          status?: string
          subject: string
          subtopic?: string
          total_pages?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          chunks_done?: number
          chunks_total?: number
          created_at?: string
          error?: string | null
          id?: string
          lease_until?: string | null
          pdf_name?: string
          questions_found?: number
          questions_solved?: number
          status?: string
          subject?: string
          subtopic?: string
          total_pages?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      card_flags: {
        Row: {
          card_id: string
          created_at: string
          id: string
          note: string
          sub_subject: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          id?: string
          note?: string
          sub_subject?: string
          subject?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          id?: string
          note?: string
          sub_subject?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      card_reviews: {
        Row: {
          card_id: string
          created_at: string
          difficulty: number | null
          due_at: string
          ease: number
          id: string
          interval_days: number
          lapses: number
          last_grade: number | null
          last_review_at: string | null
          leech: boolean
          reps: number
          stability: number | null
          state: string
          step: number
          sub_subject: string
          subject: string
          suspended: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          difficulty?: number | null
          due_at?: string
          ease?: number
          id?: string
          interval_days?: number
          lapses?: number
          last_grade?: number | null
          last_review_at?: string | null
          leech?: boolean
          reps?: number
          stability?: number | null
          state?: string
          step?: number
          sub_subject?: string
          subject?: string
          suspended?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          difficulty?: number | null
          due_at?: string
          ease?: number
          id?: string
          interval_days?: number
          lapses?: number
          last_grade?: number | null
          last_review_at?: string | null
          leech?: boolean
          reps?: number
          stability?: number | null
          state?: string
          step?: number
          sub_subject?: string
          subject?: string
          suspended?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      content_consents: {
        Row: {
          accepted_at: string
          ip: string | null
          scope: string
          ua: string | null
          user_id: string
        }
        Insert: {
          accepted_at?: string
          ip?: string | null
          scope?: string
          ua?: string | null
          user_id: string
        }
        Update: {
          accepted_at?: string
          ip?: string | null
          scope?: string
          ua?: string | null
          user_id?: string
        }
        Relationships: []
      }
      content_events: {
        Row: {
          context: string | null
          created_at: string
          id: string
          ip: string | null
          kind: string
          meta: Json
          ua: string | null
          user_id: string
        }
        Insert: {
          context?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          kind: string
          meta?: Json
          ua?: string | null
          user_id: string
        }
        Update: {
          context?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          kind?: string
          meta?: Json
          ua?: string | null
          user_id?: string
        }
        Relationships: []
      }
      courses: {
        Row: {
          admin_only: boolean
          badge: string | null
          badge_color: string | null
          badge_expires_at: string | null
          category: string
          compare_at_price: number | null
          created_at: string
          created_by: string | null
          currency: string
          discount_active: boolean
          discount_ends_at: string | null
          exam_type: string
          id: string
          image_url: string | null
          intro_free: boolean
          intro_video_storage_path: string | null
          intro_video_url: string | null
          kind: string
          paddle_price_id: string | null
          price: number
          published: boolean
          questions_count_final: number
          questions_count_mid: number
          show_on_home: boolean
          subjects_count: number
          title: string
          university_id: string
          updated_at: string
          year: number
        }
        Insert: {
          admin_only?: boolean
          badge?: string | null
          badge_color?: string | null
          badge_expires_at?: string | null
          category?: string
          compare_at_price?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_active?: boolean
          discount_ends_at?: string | null
          exam_type?: string
          id?: string
          image_url?: string | null
          intro_free?: boolean
          intro_video_storage_path?: string | null
          intro_video_url?: string | null
          kind?: string
          paddle_price_id?: string | null
          price?: number
          published?: boolean
          questions_count_final?: number
          questions_count_mid?: number
          show_on_home?: boolean
          subjects_count?: number
          title: string
          university_id: string
          updated_at?: string
          year: number
        }
        Update: {
          admin_only?: boolean
          badge?: string | null
          badge_color?: string | null
          badge_expires_at?: string | null
          category?: string
          compare_at_price?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_active?: boolean
          discount_ends_at?: string | null
          exam_type?: string
          id?: string
          image_url?: string | null
          intro_free?: boolean
          intro_video_storage_path?: string | null
          intro_video_url?: string | null
          kind?: string
          paddle_price_id?: string | null
          price?: number
          published?: boolean
          questions_count_final?: number
          questions_count_mid?: number
          show_on_home?: boolean
          subjects_count?: number
          title?: string
          university_id?: string
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      de_attempts: {
        Row: {
          correct: boolean
          created_at: string
          id: string
          item_id: string
          mode: string
          score: number
          user_id: string
        }
        Insert: {
          correct?: boolean
          created_at?: string
          id?: string
          item_id: string
          mode?: string
          score?: number
          user_id: string
        }
        Update: {
          correct?: boolean
          created_at?: string
          id?: string
          item_id?: string
          mode?: string
          score?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "de_attempts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "de_items"
            referencedColumns: ["id"]
          },
        ]
      }
      de_flags: {
        Row: {
          created_at: string
          id: string
          item_id: string
          note: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id: string
          note?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string
          note?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "de_flags_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "de_items"
            referencedColumns: ["id"]
          },
        ]
      }
      de_items: {
        Row: {
          article: string | null
          created_at: string
          english: string | null
          german: string
          id: string
          is_sample: boolean
          kind: string
          plural: string | null
          position: number
          subtopic_id: string
          user_id: string | null
        }
        Insert: {
          article?: string | null
          created_at?: string
          english?: string | null
          german: string
          id?: string
          is_sample?: boolean
          kind?: string
          plural?: string | null
          position?: number
          subtopic_id: string
          user_id?: string | null
        }
        Update: {
          article?: string | null
          created_at?: string
          english?: string | null
          german?: string
          id?: string
          is_sample?: boolean
          kind?: string
          plural?: string | null
          position?: number
          subtopic_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "de_items_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "de_subtopics"
            referencedColumns: ["id"]
          },
        ]
      }
      de_subjects: {
        Row: {
          color: string
          created_at: string
          id: string
          is_sample: boolean
          mode: string
          name: string
          position: number
          user_id: string | null
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_sample?: boolean
          mode?: string
          name: string
          position?: number
          user_id?: string | null
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_sample?: boolean
          mode?: string
          name?: string
          position?: number
          user_id?: string | null
        }
        Relationships: []
      }
      de_subtopics: {
        Row: {
          created_at: string
          id: string
          is_sample: boolean
          name: string
          position: number
          subject_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_sample?: boolean
          name: string
          position?: number
          subject_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_sample?: boolean
          name?: string
          position?: number
          subject_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "de_subtopics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "de_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      deck_ratings: {
        Row: {
          created_at: string
          deck_id: string
          id: string
          note: string | null
          space_id: string | null
          stars: number
          under_review: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deck_id: string
          id?: string
          note?: string | null
          space_id?: string | null
          stars: number
          under_review?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deck_id?: string
          id?: string
          note?: string | null
          space_id?: string | null
          stars?: number
          under_review?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "deck_ratings_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "shared_decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deck_ratings_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      device_security_settings: {
        Row: {
          created_at: string
          default_device_limit: number
          id: boolean
          support_url: string
          telegram_url: string
          unlock_code: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_device_limit?: number
          id?: boolean
          support_url?: string
          telegram_url?: string
          unlock_code: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_device_limit?: number
          id?: boolean
          support_url?: string
          telegram_url?: string
          unlock_code?: string
          updated_at?: string
        }
        Relationships: []
      }
      device_unlock_attempts: {
        Row: {
          code_used: string | null
          created_at: string
          id: string
          ip: string | null
          success: boolean
          user_agent: string | null
          user_id: string
        }
        Insert: {
          code_used?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          success?: boolean
          user_agent?: string | null
          user_id: string
        }
        Update: {
          code_used?: string | null
          created_at?: string
          id?: string
          ip?: string | null
          success?: boolean
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      flash_cards: {
        Row: {
          back: string
          created_at: string
          ease: number
          front: string
          id: string
          last_reviewed_at: string | null
          reviews: number
          sort: number
          subject_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          back: string
          created_at?: string
          ease?: number
          front: string
          id?: string
          last_reviewed_at?: string | null
          reviews?: number
          sort?: number
          subject_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          back?: string
          created_at?: string
          ease?: number
          front?: string
          id?: string
          last_reviewed_at?: string | null
          reviews?: number
          sort?: number
          subject_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_cards_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "flash_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      flash_subjects: {
        Row: {
          color: string
          created_at: string
          emoji: string | null
          id: string
          name: string
          parent_id: string | null
          sort: number
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          emoji?: string | null
          id?: string
          name: string
          parent_id?: string | null
          sort?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          emoji?: string | null
          id?: string
          name?: string
          parent_id?: string | null
          sort?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flash_subjects_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "flash_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      german_attempts: {
        Row: {
          created_at: string
          entry_id: string
          id: string
          is_correct: boolean
          item_id: string
          mode: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_id: string
          id?: string
          is_correct: boolean
          item_id: string
          mode: string
          user_id: string
        }
        Update: {
          created_at?: string
          entry_id?: string
          id?: string
          is_correct?: boolean
          item_id?: string
          mode?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "german_attempts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "german_items"
            referencedColumns: ["id"]
          },
        ]
      }
      german_courses: {
        Row: {
          content_type: string
          created_at: string
          id: string
          image_path: string | null
          position: number
          published: boolean
          title: string
          updated_at: string
        }
        Insert: {
          content_type?: string
          created_at?: string
          id?: string
          image_path?: string | null
          position?: number
          published?: boolean
          title: string
          updated_at?: string
        }
        Update: {
          content_type?: string
          created_at?: string
          id?: string
          image_path?: string | null
          position?: number
          published?: boolean
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      german_flags: {
        Row: {
          course_id: string | null
          created_at: string
          english: string
          entry_id: string
          german: string
          id: string
          kind: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          english: string
          entry_id: string
          german: string
          id?: string
          kind: string
          user_id: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          english?: string
          entry_id?: string
          german?: string
          id?: string
          kind?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "german_flags_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "german_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      german_items: {
        Row: {
          created_at: string
          id: string
          is_free: boolean
          kind: string
          position: number
          subject_id: string
          title: string
          video_storage_path: string | null
          video_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_free?: boolean
          kind: string
          position?: number
          subject_id: string
          title: string
          video_storage_path?: string | null
          video_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_free?: boolean
          kind?: string
          position?: number
          subject_id?: string
          title?: string
          video_storage_path?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "german_items_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "german_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      german_quiz_options: {
        Row: {
          body: string
          id: string
          is_correct: boolean
          position: number
          question_id: string
        }
        Insert: {
          body: string
          id?: string
          is_correct?: boolean
          position?: number
          question_id: string
        }
        Update: {
          body?: string
          id?: string
          is_correct?: boolean
          position?: number
          question_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "german_quiz_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "german_quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      german_quiz_questions: {
        Row: {
          created_at: string
          explanation: string | null
          id: string
          position: number
          prompt: string
          published: boolean
          quiz_id: string
        }
        Insert: {
          created_at?: string
          explanation?: string | null
          id?: string
          position?: number
          prompt: string
          published?: boolean
          quiz_id: string
        }
        Update: {
          created_at?: string
          explanation?: string | null
          id?: string
          position?: number
          prompt?: string
          published?: boolean
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "german_quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "german_quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      german_quizzes: {
        Row: {
          id: string
          item_id: string
        }
        Insert: {
          id?: string
          item_id: string
        }
        Update: {
          id?: string
          item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "german_quizzes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: true
            referencedRelation: "german_items"
            referencedColumns: ["id"]
          },
        ]
      }
      german_sentence_entries: {
        Row: {
          created_at: string
          english: string
          german: string
          id: string
          item_id: string
          notes: string | null
          position: number
        }
        Insert: {
          created_at?: string
          english: string
          german: string
          id?: string
          item_id: string
          notes?: string | null
          position?: number
        }
        Update: {
          created_at?: string
          english?: string
          german?: string
          id?: string
          item_id?: string
          notes?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "german_sentence_entries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "german_items"
            referencedColumns: ["id"]
          },
        ]
      }
      german_shadowing_sessions: {
        Row: {
          course_id: string
          created_at: string
          details: Json
          id: string
          kind: string
          score_avg: number
          subject_ids: string[]
          total_items: number
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          details?: Json
          id?: string
          kind: string
          score_avg?: number
          subject_ids?: string[]
          total_items?: number
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          details?: Json
          id?: string
          kind?: string
          score_avg?: number
          subject_ids?: string[]
          total_items?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "german_shadowing_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "german_courses"
            referencedColumns: ["id"]
          },
        ]
      }
      german_subjects: {
        Row: {
          content_type: string
          course_id: string
          created_at: string
          id: string
          owner_user_id: string | null
          parent_id: string | null
          position: number
          title: string
        }
        Insert: {
          content_type?: string
          course_id: string
          created_at?: string
          id?: string
          owner_user_id?: string | null
          parent_id?: string | null
          position?: number
          title: string
        }
        Update: {
          content_type?: string
          course_id?: string
          created_at?: string
          id?: string
          owner_user_id?: string | null
          parent_id?: string | null
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "german_subjects_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "german_courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "german_subjects_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "german_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      german_voice_attempts: {
        Row: {
          created_at: string
          entry_id: string | null
          id: string
          item_id: string | null
          mode: string
          score: number | null
          subject_id: string | null
          target_text: string
          transcript: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          entry_id?: string | null
          id?: string
          item_id?: string | null
          mode?: string
          score?: number | null
          subject_id?: string | null
          target_text: string
          transcript?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          entry_id?: string | null
          id?: string
          item_id?: string | null
          mode?: string
          score?: number | null
          subject_id?: string | null
          target_text?: string
          transcript?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "german_voice_attempts_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "german_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "german_voice_attempts_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "german_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      german_word_entries: {
        Row: {
          created_at: string
          english: string
          example: string | null
          german: string
          id: string
          item_id: string
          position: number
        }
        Insert: {
          created_at?: string
          english: string
          example?: string | null
          german: string
          id?: string
          item_id: string
          position?: number
        }
        Update: {
          created_at?: string
          english?: string
          example?: string | null
          german?: string
          id?: string
          item_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "german_word_entries_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "german_items"
            referencedColumns: ["id"]
          },
        ]
      }
      lq_attempts: {
        Row: {
          answered_at: string
          correct: boolean
          flagged: boolean
          id: string
          lecture_id: string
          question_id: string
          user_id: string
        }
        Insert: {
          answered_at?: string
          correct?: boolean
          flagged?: boolean
          id?: string
          lecture_id: string
          question_id: string
          user_id: string
        }
        Update: {
          answered_at?: string
          correct?: boolean
          flagged?: boolean
          id?: string
          lecture_id?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lq_attempts_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lq_lectures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lq_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "lq_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      lq_lectures: {
        Row: {
          best_score: number | null
          created_at: string
          difficulty: string
          id: string
          is_example: boolean
          key_points: Json
          question_count: number
          source_name: string | null
          subtopic_id: string
          title: string
          user_id: string
        }
        Insert: {
          best_score?: number | null
          created_at?: string
          difficulty?: string
          id?: string
          is_example?: boolean
          key_points?: Json
          question_count?: number
          source_name?: string | null
          subtopic_id: string
          title: string
          user_id: string
        }
        Update: {
          best_score?: number | null
          created_at?: string
          difficulty?: string
          id?: string
          is_example?: boolean
          key_points?: Json
          question_count?: number
          source_name?: string | null
          subtopic_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lq_lectures_subtopic_id_fkey"
            columns: ["subtopic_id"]
            isOneToOne: false
            referencedRelation: "lq_subtopics"
            referencedColumns: ["id"]
          },
        ]
      }
      lq_questions: {
        Row: {
          created_at: string
          explanation: string
          id: string
          lecture_id: string
          options: Json
          point_ref: string | null
          sort_order: number
          stem: string
          user_id: string
        }
        Insert: {
          created_at?: string
          explanation?: string
          id?: string
          lecture_id: string
          options?: Json
          point_ref?: string | null
          sort_order?: number
          stem: string
          user_id: string
        }
        Update: {
          created_at?: string
          explanation?: string
          id?: string
          lecture_id?: string
          options?: Json
          point_ref?: string | null
          sort_order?: number
          stem?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lq_questions_lecture_id_fkey"
            columns: ["lecture_id"]
            isOneToOne: false
            referencedRelation: "lq_lectures"
            referencedColumns: ["id"]
          },
        ]
      }
      lq_subjects: {
        Row: {
          created_at: string
          id: string
          is_example: boolean
          name: string
          sort_order: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_example?: boolean
          name: string
          sort_order?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_example?: boolean
          name?: string
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      lq_subtopics: {
        Row: {
          created_at: string
          id: string
          is_example: boolean
          name: string
          sort_order: number
          subject_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_example?: boolean
          name: string
          sort_order?: number
          subject_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_example?: boolean
          name?: string
          sort_order?: number
          subject_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lq_subtopics_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "lq_subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_plan_grants: {
        Row: {
          expires_at: string | null
          granted_at: string
          granted_by: string
          id: string
          overrides_paid: boolean
          plan_slug: string
          reason: string
          revoke_reason: string | null
          revoked_at: string | null
          revoked_by: string | null
          starts_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string
          granted_by: string
          id?: string
          overrides_paid?: boolean
          plan_slug: string
          reason?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          starts_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string
          granted_by?: string
          id?: string
          overrides_paid?: boolean
          plan_slug?: string
          reason?: string
          revoke_reason?: string | null
          revoked_at?: string | null
          revoked_by?: string | null
          starts_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manual_plan_grants_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_plan_grants_plan_slug_fkey"
            columns: ["plan_slug"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "manual_plan_grants_revoked_by_fkey"
            columns: ["revoked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_plan_grants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          course_id: string
          created_at: string
          id: string
          question_id: string | null
          snippet_html: string
          snippet_text: string
          subject_id: string | null
          updated_at: string
          user_id: string
          user_note: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          question_id?: string | null
          snippet_html: string
          snippet_text?: string
          subject_id?: string | null
          updated_at?: string
          user_id: string
          user_note?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          question_id?: string | null
          snippet_html?: string
          snippet_text?: string
          subject_id?: string | null
          updated_at?: string
          user_id?: string
          user_note?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          id: boolean
          on_committee_resource: boolean
          on_event: boolean
          on_new_course: boolean
          on_urgent_announcement: boolean
          updated_at: string
        }
        Insert: {
          id?: boolean
          on_committee_resource?: boolean
          on_event?: boolean
          on_new_course?: boolean
          on_urgent_announcement?: boolean
          updated_at?: string
        }
        Update: {
          id?: boolean
          on_committee_resource?: boolean
          on_event?: boolean
          on_new_course?: boolean
          on_urgent_announcement?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      payment_events: {
        Row: {
          amount_cents: number | null
          course_id: string | null
          created_at: string
          currency: string | null
          environment: string
          id: string
          paddle_event_id: string | null
          paddle_transaction_id: string | null
          raw: Json | null
          status: string
          user_id: string | null
        }
        Insert: {
          amount_cents?: number | null
          course_id?: string | null
          created_at?: string
          currency?: string | null
          environment?: string
          id?: string
          paddle_event_id?: string | null
          paddle_transaction_id?: string | null
          raw?: Json | null
          status: string
          user_id?: string | null
        }
        Update: {
          amount_cents?: number | null
          course_id?: string | null
          created_at?: string
          currency?: string | null
          environment?: string
          id?: string
          paddle_event_id?: string | null
          paddle_transaction_id?: string | null
          raw?: Json | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      plan_credit_grants: {
        Row: {
          ai_questions: number
          all_in_one_lectures: number
          all_in_one_questions: number
          archive_questions: number
          calendar_items: number
          created_at: string
          environment: string
          expires_at: string | null
          flashcards: number
          groups: number
          id: string
          plan_slug: string
          rita_questions: number
          summaries: number
          todo_tasks: number
          transaction_id: string
          user_id: string
        }
        Insert: {
          ai_questions?: number
          all_in_one_lectures?: number
          all_in_one_questions?: number
          archive_questions?: number
          calendar_items?: number
          created_at?: string
          environment?: string
          expires_at?: string | null
          flashcards?: number
          groups?: number
          id?: string
          plan_slug: string
          rita_questions?: number
          summaries?: number
          todo_tasks?: number
          transaction_id: string
          user_id: string
        }
        Update: {
          ai_questions?: number
          all_in_one_lectures?: number
          all_in_one_questions?: number
          archive_questions?: number
          calendar_items?: number
          created_at?: string
          environment?: string
          expires_at?: string | null
          flashcards?: number
          groups?: number
          id?: string
          plan_slug?: string
          rita_questions?: number
          summaries?: number
          todo_tasks?: number
          transaction_id?: string
          user_id?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          billing_kind: string
          compare_cents: number | null
          created_at: string
          cta_label: string
          currency: string
          feature_ai_import: boolean
          feature_all_in_one: boolean
          feature_archive_qgen: boolean
          feature_lecture_qgen: boolean
          feature_review: boolean
          highlight: boolean
          max_ai_questions: number | null
          max_all_in_one_lectures: number | null
          max_all_in_one_questions: number | null
          max_archive_questions: number | null
          max_calendar_items: number | null
          max_flashcards: number | null
          max_groups: number | null
          max_summaries: number | null
          max_todo_tasks: number | null
          name: string
          offer_ends_at: string | null
          once_cents: number
          paddle_price_monthly: string | null
          paddle_price_once: string | null
          paddle_price_yearly: string | null
          perks: string[]
          price_cents: number
          published: boolean
          ribbon_color: string | null
          ribbon_label: string | null
          rich_cards: boolean
          slug: string
          sort: number
          tagline: string
          todo_full: boolean
          updated_at: string
          yearly_cents: number
        }
        Insert: {
          billing_kind?: string
          compare_cents?: number | null
          created_at?: string
          cta_label?: string
          currency?: string
          feature_ai_import?: boolean
          feature_all_in_one?: boolean
          feature_archive_qgen?: boolean
          feature_lecture_qgen?: boolean
          feature_review?: boolean
          highlight?: boolean
          max_ai_questions?: number | null
          max_all_in_one_lectures?: number | null
          max_all_in_one_questions?: number | null
          max_archive_questions?: number | null
          max_calendar_items?: number | null
          max_flashcards?: number | null
          max_groups?: number | null
          max_summaries?: number | null
          max_todo_tasks?: number | null
          name: string
          offer_ends_at?: string | null
          once_cents?: number
          paddle_price_monthly?: string | null
          paddle_price_once?: string | null
          paddle_price_yearly?: string | null
          perks?: string[]
          price_cents?: number
          published?: boolean
          ribbon_color?: string | null
          ribbon_label?: string | null
          rich_cards?: boolean
          slug: string
          sort?: number
          tagline?: string
          todo_full?: boolean
          updated_at?: string
          yearly_cents?: number
        }
        Update: {
          billing_kind?: string
          compare_cents?: number | null
          created_at?: string
          cta_label?: string
          currency?: string
          feature_ai_import?: boolean
          feature_all_in_one?: boolean
          feature_archive_qgen?: boolean
          feature_lecture_qgen?: boolean
          feature_review?: boolean
          highlight?: boolean
          max_ai_questions?: number | null
          max_all_in_one_lectures?: number | null
          max_all_in_one_questions?: number | null
          max_archive_questions?: number | null
          max_calendar_items?: number | null
          max_flashcards?: number | null
          max_groups?: number | null
          max_summaries?: number | null
          max_todo_tasks?: number | null
          name?: string
          offer_ends_at?: string | null
          once_cents?: number
          paddle_price_monthly?: string | null
          paddle_price_once?: string | null
          paddle_price_yearly?: string | null
          perks?: string[]
          price_cents?: number
          published?: boolean
          ribbon_color?: string | null
          ribbon_label?: string | null
          rich_cards?: boolean
          slug?: string
          sort?: number
          tagline?: string
          todo_full?: boolean
          updated_at?: string
          yearly_cents?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          device_limit: number | null
          display_name: string | null
          email: string
          full_name: string
          id: string
          lock_kind: string | null
          lock_message: string | null
          lock_reason: string | null
          lock_until: string | null
          locked_at: string | null
          phone: string | null
          tour_seen_at: string | null
          updated_at: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          device_limit?: number | null
          display_name?: string | null
          email: string
          full_name: string
          id: string
          lock_kind?: string | null
          lock_message?: string | null
          lock_reason?: string | null
          lock_until?: string | null
          locked_at?: string | null
          phone?: string | null
          tour_seen_at?: string | null
          updated_at?: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          device_limit?: number | null
          display_name?: string | null
          email?: string
          full_name?: string
          id?: string
          lock_kind?: string | null
          lock_message?: string | null
          lock_reason?: string | null
          lock_until?: string | null
          locked_at?: string | null
          phone?: string | null
          tour_seen_at?: string | null
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          full_name: string | null
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "public_profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_deliveries: {
        Row: {
          created_at: string
          endpoint: string
          error: string
          id: string
          message_id: string
          ok: boolean
          status_code: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          endpoint?: string
          error?: string
          id?: string
          message_id: string
          ok?: boolean
          status_code?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          error?: string
          id?: string
          message_id?: string
          ok?: boolean
          status_code?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_deliveries_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "push_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      push_messages: {
        Row: {
          audience_group_ids: string[]
          body_ar: string
          body_en: string
          created_at: string
          created_by: string | null
          failed_count: number
          id: string
          scheduled_at: string | null
          sent_at: string | null
          sent_count: number
          source: string
          status: string
          title_ar: string
          title_en: string
          url: string
        }
        Insert: {
          audience_group_ids?: string[]
          body_ar?: string
          body_en?: string
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number
          source?: string
          status?: string
          title_ar?: string
          title_en?: string
          url?: string
        }
        Update: {
          audience_group_ids?: string[]
          body_ar?: string
          body_en?: string
          created_at?: string
          created_by?: string | null
          failed_count?: number
          id?: string
          scheduled_at?: string | null
          sent_at?: string | null
          sent_count?: number
          source?: string
          status?: string
          title_ar?: string
          title_en?: string
          url?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          enabled: boolean
          endpoint: string
          id: string
          lang: string
          last_used_at: string | null
          p256dh: string
          user_agent: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          enabled?: boolean
          endpoint: string
          id?: string
          lang?: string
          last_used_at?: string | null
          p256dh: string
          user_agent?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          enabled?: boolean
          endpoint?: string
          id?: string
          lang?: string
          last_used_at?: string | null
          p256dh?: string
          user_agent?: string
          user_id?: string
        }
        Relationships: []
      }
      question_attempts: {
        Row: {
          attempted_at: string
          id: string
          is_correct: boolean
          mode: string
          question_id: string
          selected_label: string | null
          user_id: string
        }
        Insert: {
          attempted_at?: string
          id?: string
          is_correct?: boolean
          mode: string
          question_id: string
          selected_label?: string | null
          user_id: string
        }
        Update: {
          attempted_at?: string
          id?: string
          is_correct?: boolean
          mode?: string
          question_id?: string
          selected_label?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_attempts_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_flags: {
        Row: {
          created_at: string
          question_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          question_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          question_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "question_flags_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      question_options: {
        Row: {
          created_at: string
          id: string
          is_correct: boolean
          label: string
          owner_user_id: string | null
          question_id: string
          sort_order: number
          text: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_correct?: boolean
          label: string
          owner_user_id?: string | null
          question_id: string
          sort_order?: number
          text?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_correct?: boolean
          label?: string
          owner_user_id?: string | null
          question_id?: string
          sort_order?: number
          text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "question_options_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
        ]
      }
      questions: {
        Row: {
          created_at: string
          explanation: string | null
          id: string
          image_url: string | null
          owner_user_id: string | null
          sort_order: number
          stem: string
          stem_hash: string | null
          subject_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          explanation?: string | null
          id?: string
          image_url?: string | null
          owner_user_id?: string | null
          sort_order?: number
          stem: string
          stem_hash?: string | null
          subject_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          explanation?: string | null
          id?: string
          image_url?: string | null
          owner_user_id?: string | null
          sort_order?: number
          stem?: string
          stem_hash?: string | null
          subject_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "questions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      review_events: {
        Row: {
          card_id: string
          created_at: string
          elapsed_days: number | null
          grade: number
          id: string
          ms: number
          prev: Json | null
          sub_subject: string
          subject: string
          user_id: string
        }
        Insert: {
          card_id: string
          created_at?: string
          elapsed_days?: number | null
          grade: number
          id?: string
          ms?: number
          prev?: Json | null
          sub_subject?: string
          subject?: string
          user_id: string
        }
        Update: {
          card_id?: string
          created_at?: string
          elapsed_days?: number | null
          grade?: number
          id?: string
          ms?: number
          prev?: Json | null
          sub_subject?: string
          subject?: string
          user_id?: string
        }
        Relationships: []
      }
      rita_ai_chunks: {
        Row: {
          batch_id: string | null
          chunk_index: number
          chunk_text: string | null
          created_at: string
          error: string | null
          id: string
          imported_count: number
          job_id: string
          page_from: number
          page_to: number
          question_blocks: Json | null
          results: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          batch_id?: string | null
          chunk_index: number
          chunk_text?: string | null
          created_at?: string
          error?: string | null
          id?: string
          imported_count?: number
          job_id: string
          page_from: number
          page_to: number
          question_blocks?: Json | null
          results?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          batch_id?: string | null
          chunk_index?: number
          chunk_text?: string | null
          created_at?: string
          error?: string | null
          id?: string
          imported_count?: number
          job_id?: string
          page_from?: number
          page_to?: number
          question_blocks?: Json | null
          results?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rita_ai_chunks_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "rita_ai_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      rita_ai_jobs: {
        Row: {
          chunks_done: number
          chunks_total: number
          course_id: string
          created_at: string
          error: string | null
          group_id: string | null
          id: string
          imported_total: number
          lease_until: string | null
          log: Json
          pages_per_chunk: number
          pdf_name: string
          status: string
          subject_id: string
          total_pages: number
          updated_at: string
          user_id: string
        }
        Insert: {
          chunks_done?: number
          chunks_total?: number
          course_id: string
          created_at?: string
          error?: string | null
          group_id?: string | null
          id?: string
          imported_total?: number
          lease_until?: string | null
          log?: Json
          pages_per_chunk?: number
          pdf_name: string
          status?: string
          subject_id: string
          total_pages?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          chunks_done?: number
          chunks_total?: number
          course_id?: string
          created_at?: string
          error?: string | null
          group_id?: string | null
          id?: string
          imported_total?: number
          lease_until?: string | null
          log?: Json
          pages_per_chunk?: number
          pdf_name?: string
          status?: string
          subject_id?: string
          total_pages?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      shared_deck_cards: {
        Row: {
          back: string
          created_at: string
          deck_id: string
          front: string
          group_name: string | null
          id: string
          owner_id: string
          sort: number
        }
        Insert: {
          back: string
          created_at?: string
          deck_id: string
          front: string
          group_name?: string | null
          id?: string
          owner_id: string
          sort?: number
        }
        Update: {
          back?: string
          created_at?: string
          deck_id?: string
          front?: string
          group_name?: string | null
          id?: string
          owner_id?: string
          sort?: number
        }
        Relationships: [
          {
            foreignKeyName: "shared_deck_cards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "shared_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_deck_saves: {
        Row: {
          created_at: string
          deck_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deck_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          deck_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_deck_saves_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "shared_decks"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_decks: {
        Row: {
          audience: string
          card_count: number
          cover: string
          created_at: string
          description: string | null
          emoji: string | null
          id: string
          owner_id: string
          published: boolean
          rating_avg: number
          rating_count: number
          save_count: number
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          audience?: string
          card_count?: number
          cover?: string
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          owner_id: string
          published?: boolean
          rating_avg?: number
          rating_count?: number
          save_count?: number
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          audience?: string
          card_count?: number
          cover?: string
          created_at?: string
          description?: string | null
          emoji?: string | null
          id?: string
          owner_id?: string
          published?: boolean
          rating_avg?: number
          rating_count?: number
          save_count?: number
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_announcements: {
        Row: {
          accent: string
          active: boolean
          body: string
          button_href: string | null
          button_label: string | null
          created_at: string
          delay_seconds: number
          ends_at: string | null
          frequency: string
          href: string | null
          href_label: string | null
          id: string
          image_url: string | null
          paths: string[]
          pinned: boolean
          secondary_href: string | null
          secondary_label: string | null
          sort: number
          starts_at: string | null
          style: string
          title: string
          trigger: string
          updated_at: string
          urgent: boolean
        }
        Insert: {
          accent?: string
          active?: boolean
          body?: string
          button_href?: string | null
          button_label?: string | null
          created_at?: string
          delay_seconds?: number
          ends_at?: string | null
          frequency?: string
          href?: string | null
          href_label?: string | null
          id?: string
          image_url?: string | null
          paths?: string[]
          pinned?: boolean
          secondary_href?: string | null
          secondary_label?: string | null
          sort?: number
          starts_at?: string | null
          style?: string
          title?: string
          trigger?: string
          updated_at?: string
          urgent?: boolean
        }
        Update: {
          accent?: string
          active?: boolean
          body?: string
          button_href?: string | null
          button_label?: string | null
          created_at?: string
          delay_seconds?: number
          ends_at?: string | null
          frequency?: string
          href?: string | null
          href_label?: string | null
          id?: string
          image_url?: string | null
          paths?: string[]
          pinned?: boolean
          secondary_href?: string | null
          secondary_label?: string | null
          sort?: number
          starts_at?: string | null
          style?: string
          title?: string
          trigger?: string
          updated_at?: string
          urgent?: boolean
        }
        Relationships: []
      }
      site_images: {
        Row: {
          created_at: string
          key: string
          path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          key: string
          path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          key?: string
          path?: string
          updated_at?: string
        }
        Relationships: []
      }
      site_secrets: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          value?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          brand_style: string
          classic_colors: boolean
          committee_default_storage: string
          committee_qr_link: string | null
          committee_qr_path: string | null
          credit_packs_enabled: boolean
          feature_ai_cards_enabled: boolean
          header_style: string
          home_video_poster_url: string | null
          home_video_url: string | null
          id: boolean
          logo_url: string | null
          offers_page_enabled: boolean
          privacy_ar: string | null
          privacy_en: string | null
          protect_auto_lock_threshold: number
          protect_block_copy: boolean
          protect_block_print: boolean
          protect_blur_on_blur: boolean
          protect_consent_required: boolean
          protect_devtools_guard: boolean
          protect_enabled: boolean
          protect_terms_ar: string | null
          protect_terms_en: string | null
          protect_watermark_opacity: number
          refund_ar: string | null
          refund_en: string | null
          show_signature: boolean
          site_name: string
          study_hub_subtitle: string | null
          study_hub_subtitle_ar: string | null
          study_hub_title: string | null
          study_hub_title_ar: string | null
          study_plan_path: string | null
          study_plan_subtitle: string | null
          study_plan_title: string | null
          tagline: string
          terms_ar: string | null
          terms_en: string | null
          theme: string
          toolkit_free_enabled: boolean
          toolkit_free_plan: string
          updated_at: string
        }
        Insert: {
          brand_style?: string
          classic_colors?: boolean
          committee_default_storage?: string
          committee_qr_link?: string | null
          committee_qr_path?: string | null
          credit_packs_enabled?: boolean
          feature_ai_cards_enabled?: boolean
          header_style?: string
          home_video_poster_url?: string | null
          home_video_url?: string | null
          id?: boolean
          logo_url?: string | null
          offers_page_enabled?: boolean
          privacy_ar?: string | null
          privacy_en?: string | null
          protect_auto_lock_threshold?: number
          protect_block_copy?: boolean
          protect_block_print?: boolean
          protect_blur_on_blur?: boolean
          protect_consent_required?: boolean
          protect_devtools_guard?: boolean
          protect_enabled?: boolean
          protect_terms_ar?: string | null
          protect_terms_en?: string | null
          protect_watermark_opacity?: number
          refund_ar?: string | null
          refund_en?: string | null
          show_signature?: boolean
          site_name?: string
          study_hub_subtitle?: string | null
          study_hub_subtitle_ar?: string | null
          study_hub_title?: string | null
          study_hub_title_ar?: string | null
          study_plan_path?: string | null
          study_plan_subtitle?: string | null
          study_plan_title?: string | null
          tagline?: string
          terms_ar?: string | null
          terms_en?: string | null
          theme?: string
          toolkit_free_enabled?: boolean
          toolkit_free_plan?: string
          updated_at?: string
        }
        Update: {
          brand_style?: string
          classic_colors?: boolean
          committee_default_storage?: string
          committee_qr_link?: string | null
          committee_qr_path?: string | null
          credit_packs_enabled?: boolean
          feature_ai_cards_enabled?: boolean
          header_style?: string
          home_video_poster_url?: string | null
          home_video_url?: string | null
          id?: boolean
          logo_url?: string | null
          offers_page_enabled?: boolean
          privacy_ar?: string | null
          privacy_en?: string | null
          protect_auto_lock_threshold?: number
          protect_block_copy?: boolean
          protect_block_print?: boolean
          protect_blur_on_blur?: boolean
          protect_consent_required?: boolean
          protect_devtools_guard?: boolean
          protect_enabled?: boolean
          protect_terms_ar?: string | null
          protect_terms_en?: string | null
          protect_watermark_opacity?: number
          refund_ar?: string | null
          refund_en?: string | null
          show_signature?: boolean
          site_name?: string
          study_hub_subtitle?: string | null
          study_hub_subtitle_ar?: string | null
          study_hub_title?: string | null
          study_hub_title_ar?: string | null
          study_plan_path?: string | null
          study_plan_subtitle?: string | null
          study_plan_title?: string | null
          tagline?: string
          terms_ar?: string | null
          terms_en?: string | null
          theme?: string
          toolkit_free_enabled?: boolean
          toolkit_free_plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      space_announcements: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          pinned: boolean
          space_id: string
        }
        Insert: {
          author_id?: string
          body: string
          created_at?: string
          id?: string
          pinned?: boolean
          space_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          pinned?: boolean
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_announcements_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_decks: {
        Row: {
          added_by: string
          created_at: string
          deck_id: string
          folder_id: string | null
          id: string
          space_id: string
        }
        Insert: {
          added_by?: string
          created_at?: string
          deck_id: string
          folder_id?: string | null
          id?: string
          space_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          deck_id?: string
          folder_id?: string | null
          id?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_decks_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "shared_decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_decks_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "space_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "space_decks_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          sort: number
          space_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sort?: number
          space_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sort?: number
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_folders_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_invites: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          max_uses: number | null
          space_id: string
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          space_id: string
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          space_id?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "space_invites_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_members: {
        Row: {
          joined_at: string
          muted: boolean
          role: string
          space_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          muted?: boolean
          role?: string
          space_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          muted?: boolean
          role?: string
          space_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_members_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      space_messages: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          space_id: string
        }
        Insert: {
          author_id?: string
          body: string
          created_at?: string
          id?: string
          space_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          space_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "space_messages_space_id_fkey"
            columns: ["space_id"]
            isOneToOne: false
            referencedRelation: "spaces"
            referencedColumns: ["id"]
          },
        ]
      }
      spaces: {
        Row: {
          chat_enabled: boolean
          color: string
          created_at: string
          description: string | null
          discoverable: boolean
          emoji: string | null
          id: string
          image_url: string | null
          kind: string
          name: string
          owner_id: string
          updated_at: string
          who_can_add_decks: string
          who_can_post: string
        }
        Insert: {
          chat_enabled?: boolean
          color?: string
          created_at?: string
          description?: string | null
          discoverable?: boolean
          emoji?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          name: string
          owner_id?: string
          updated_at?: string
          who_can_add_decks?: string
          who_can_post?: string
        }
        Update: {
          chat_enabled?: boolean
          color?: string
          created_at?: string
          description?: string | null
          discoverable?: boolean
          emoji?: string | null
          id?: string
          image_url?: string | null
          kind?: string
          name?: string
          owner_id?: string
          updated_at?: string
          who_can_add_decks?: string
          who_can_post?: string
        }
        Relationships: []
      }
      special_offers: {
        Row: {
          accent: string
          badge: string
          bullets: string[]
          created_at: string
          duration_days: number
          id: string
          image_url: string | null
          is_active: boolean
          plan_slug: string
          requires_code: boolean
          slug: string
          sort: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          accent?: string
          badge?: string
          bullets?: string[]
          created_at?: string
          duration_days?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          plan_slug: string
          requires_code?: boolean
          slug: string
          sort?: number
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          accent?: string
          badge?: string
          bullets?: string[]
          created_at?: string
          duration_days?: number
          id?: string
          image_url?: string | null
          is_active?: boolean
          plan_slug?: string
          requires_code?: boolean
          slug?: string
          sort?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      study_days: {
        Row: {
          cards: number
          correct: number
          day: string
          frozen: boolean
          goal_met: boolean
          ms: number
          updated_at: string
          user_id: string
        }
        Insert: {
          cards?: number
          correct?: number
          day: string
          frozen?: boolean
          goal_met?: boolean
          ms?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          cards?: number
          correct?: number
          day?: string
          frozen?: boolean
          goal_met?: boolean
          ms?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_exams: {
        Row: {
          created_at: string
          id: string
          location: string | null
          notes: string | null
          starts_at: string
          subject: string | null
          subject_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          starts_at: string
          subject?: string | null
          subject_id?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          location?: string | null
          notes?: string | null
          starts_at?: string
          subject?: string | null
          subject_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_hub_tiles: {
        Row: {
          created_at: string
          description: string | null
          description_ar: string | null
          external: boolean
          hidden: boolean
          href: string
          icon: string
          id: string
          label: string
          label_ar: string | null
          sort: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          description_ar?: string | null
          external?: boolean
          hidden?: boolean
          href?: string
          icon?: string
          id?: string
          label: string
          label_ar?: string | null
          sort?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          description_ar?: string | null
          external?: boolean
          hidden?: boolean
          href?: string
          icon?: string
          id?: string
          label?: string
          label_ar?: string | null
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      study_prefs: {
        Row: {
          created_at: string
          daily_goal: number
          freeze_week: string | null
          freezes_left: number
          new_per_day: number
          retention: number
          review_cap: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          daily_goal?: number
          freeze_week?: string | null
          freezes_left?: number
          new_per_day?: number
          retention?: number
          review_cap?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          daily_goal?: number
          freeze_week?: string | null
          freezes_left?: number
          new_per_day?: number
          retention?: number
          review_cap?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      study_questions: {
        Row: {
          concept: string
          created_at: string
          difficulty: string
          explanation: string
          flagged: boolean
          id: string
          options: Json
          position: number
          source_job_id: string | null
          stem: string
          subject: string
          subtopic: string
          summary_table: string
          updated_at: string
          user_id: string
        }
        Insert: {
          concept?: string
          created_at?: string
          difficulty?: string
          explanation?: string
          flagged?: boolean
          id?: string
          options?: Json
          position?: number
          source_job_id?: string | null
          stem: string
          subject: string
          subtopic?: string
          summary_table?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          concept?: string
          created_at?: string
          difficulty?: string
          explanation?: string
          flagged?: boolean
          id?: string
          options?: Json
          position?: number
          source_job_id?: string | null
          stem?: string
          subject?: string
          subtopic?: string
          summary_table?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_questions_source_job_id_fkey"
            columns: ["source_job_id"]
            isOneToOne: false
            referencedRelation: "archive_jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      study_state: {
        Row: {
          created_at: string
          id: string
          key: string
          updated_at: string
          user_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          id?: string
          key: string
          updated_at?: string
          user_id: string
          value?: Json
        }
        Update: {
          created_at?: string
          id?: string
          key?: string
          updated_at?: string
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      subject_groups: {
        Row: {
          course_id: string
          created_at: string
          id: string
          name: string
          owner_user_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          name: string
          owner_user_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subject_groups_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          access_level: Database["public"]["Enums"]["subject_access"]
          created_at: string
          group_id: string
          id: string
          name: string
          owner_user_id: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          access_level?: Database["public"]["Enums"]["subject_access"]
          created_at?: string
          group_id: string
          id?: string
          name: string
          owner_user_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          access_level?: Database["public"]["Enums"]["subject_access"]
          created_at?: string
          group_id?: string
          id?: string
          name?: string
          owner_user_id?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "subject_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          id: string
          paddle_customer_id: string | null
          paddle_subscription_id: string
          plan_slug: string | null
          price_id: string | null
          product_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string | null
          paddle_subscription_id: string
          plan_slug?: string | null
          price_id?: string | null
          product_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          id?: string
          paddle_customer_id?: string | null
          paddle_subscription_id?: string
          plan_slug?: string | null
          price_id?: string | null
          product_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      summaries: {
        Row: {
          author_name: string | null
          content: Json
          cover_scheme: string
          created_at: string
          id: string
          is_example: boolean
          is_public: boolean
          length_preset: string
          share_slug: string | null
          source_ref: Json
          source_type: string
          subtitle: string | null
          title: string
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          author_name?: string | null
          content?: Json
          cover_scheme?: string
          created_at?: string
          id?: string
          is_example?: boolean
          is_public?: boolean
          length_preset?: string
          share_slug?: string | null
          source_ref?: Json
          source_type: string
          subtitle?: string | null
          title: string
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          author_name?: string | null
          content?: Json
          cover_scheme?: string
          created_at?: string
          id?: string
          is_example?: boolean
          is_public?: boolean
          length_preset?: string
          share_slug?: string | null
          source_ref?: Json
          source_type?: string
          subtitle?: string | null
          title?: string
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      support_channels: {
        Row: {
          created_at: string
          href: string
          icon: string
          id: string
          kind: string
          label_ar: string
          label_en: string
          sort_order: number
          updated_at: string
          value: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          href?: string
          icon?: string
          id?: string
          kind?: string
          label_ar?: string
          label_en?: string
          sort_order?: number
          updated_at?: string
          value?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          href?: string
          icon?: string
          id?: string
          kind?: string
          label_ar?: string
          label_en?: string
          sort_order?: number
          updated_at?: string
          value?: string
          visible?: boolean
        }
        Relationships: []
      }
      support_requests: {
        Row: {
          admin_notes: string
          category: string
          created_at: string
          email: string
          id: string
          message: string
          name: string
          status: string
          subject: string
          ticket_no: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          admin_notes?: string
          category?: string
          created_at?: string
          email?: string
          id?: string
          message: string
          name?: string
          status?: string
          subject?: string
          ticket_no?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          admin_notes?: string
          category?: string
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          status?: string
          subject?: string
          ticket_no?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      support_settings: {
        Row: {
          categories: Json
          channels_enabled: boolean
          created_at: string
          form_enabled: boolean
          id: boolean
          intro_text_ar: string
          intro_text_en: string
          intro_title_ar: string
          intro_title_en: string
          notify_email: string
          notify_enabled: boolean
          page_enabled: boolean
          response_note_ar: string
          response_note_en: string
          updated_at: string
        }
        Insert: {
          categories?: Json
          channels_enabled?: boolean
          created_at?: string
          form_enabled?: boolean
          id?: boolean
          intro_text_ar?: string
          intro_text_en?: string
          intro_title_ar?: string
          intro_title_en?: string
          notify_email?: string
          notify_enabled?: boolean
          page_enabled?: boolean
          response_note_ar?: string
          response_note_en?: string
          updated_at?: string
        }
        Update: {
          categories?: Json
          channels_enabled?: boolean
          created_at?: string
          form_enabled?: boolean
          id?: boolean
          intro_text_ar?: string
          intro_text_en?: string
          intro_title_ar?: string
          intro_title_en?: string
          notify_email?: string
          notify_enabled?: boolean
          page_enabled?: boolean
          response_note_ar?: string
          response_note_en?: string
          updated_at?: string
        }
        Relationships: []
      }
      toolkit_claims: {
        Row: {
          code_id: string | null
          created_at: string
          expires_at: string | null
          id: string
          offer_id: string | null
          plan_slug: string
          user_id: string
        }
        Insert: {
          code_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          offer_id?: string | null
          plan_slug: string
          user_id: string
        }
        Update: {
          code_id?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          offer_id?: string | null
          plan_slug?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "toolkit_claims_code_id_fkey"
            columns: ["code_id"]
            isOneToOne: false
            referencedRelation: "toolkit_codes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "toolkit_claims_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "special_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      toolkit_codes: {
        Row: {
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          label: string | null
          max_uses: number | null
          offer_id: string | null
          plan_slug: string
          used_count: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          max_uses?: number | null
          offer_id?: string | null
          plan_slug: string
          used_count?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          max_uses?: number | null
          offer_id?: string | null
          plan_slug?: string
          used_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "toolkit_codes_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "special_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          ai_questions: number
          all_in_one_lectures: number
          all_in_one_questions: number
          archive_questions: number
          calendar_items: number
          flashcards: number
          groups: number
          period: string
          rita_questions: number
          summaries: number
          todo_tasks: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_questions?: number
          all_in_one_lectures?: number
          all_in_one_questions?: number
          archive_questions?: number
          calendar_items?: number
          flashcards?: number
          groups?: number
          period: string
          rita_questions?: number
          summaries?: number
          todo_tasks?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_questions?: number
          all_in_one_lectures?: number
          all_in_one_questions?: number
          archive_questions?: number
          calendar_items?: number
          flashcards?: number
          groups?: number
          period?: string
          rita_questions?: number
          summaries?: number
          todo_tasks?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_courses: {
        Row: {
          course_id: string
          created_at: string
          granted_by: string | null
          granted_reason: string | null
          id: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          granted_by?: string | null
          granted_reason?: string | null
          id?: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          granted_by?: string | null
          granted_reason?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_devices: {
        Row: {
          device_id: string
          first_seen_at: string
          id: string
          ip: string | null
          last_seen_at: string
          nickname: string | null
          platform: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          device_id: string
          first_seen_at?: string
          id?: string
          ip?: string | null
          last_seen_at?: string
          nickname?: string | null
          platform?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          device_id?: string
          first_seen_at?: string
          id?: string
          ip?: string | null
          last_seen_at?: string
          nickname?: string | null
          platform?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_group_members: {
        Row: {
          created_at: string
          group_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "user_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      user_groups: {
        Row: {
          color: string
          course_id: string | null
          created_at: string
          id: string
          kind: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          course_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          course_id?: string | null
          created_at?: string
          id?: string
          kind?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_groups_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_lecture_courses: {
        Row: {
          course_id: string
          granted_at: string
          granted_reason: string | null
          user_id: string
        }
        Insert: {
          course_id: string
          granted_at?: string
          granted_reason?: string | null
          user_id: string
        }
        Update: {
          course_id?: string
          granted_at?: string
          granted_reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_lecture_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_login_events: {
        Row: {
          id: string
          occurred_at: string
          user_id: string
        }
        Insert: {
          id?: string
          occurred_at?: string
          user_id: string
        }
        Update: {
          id?: string
          occurred_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_plans: {
        Row: {
          plan_slug: string
          updated_at: string
          user_id: string
        }
        Insert: {
          plan_slug?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          plan_slug?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_plans_plan_slug_fkey"
            columns: ["plan_slug"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["slug"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          last_seen_at: string
          started_at: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          started_at?: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          started_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      __restore_exec: { Args: { sql: string }; Returns: undefined }
      account_active: { Args: { _user_id: string }; Returns: boolean }
      admin_deck_ratings: {
        Args: { _deck_id: string }
        Returns: {
          created_at: string
          email: string
          note: string
          space_id: string
          stars: number
          under_review: boolean
          username: string
        }[]
      }
      admin_get_user_roles: {
        Args: { _user_id: string }
        Returns: {
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      admin_grant_lecture_course: {
        Args: { _course_id: string; _user_id: string }
        Returns: undefined
      }
      admin_grant_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_group_counts: {
        Args: never
        Returns: {
          group_id: string
          member_count: number
        }[]
      }
      admin_list_all_users: {
        Args: never
        Returns: {
          created_at: string
          device_limit: number
          email: string
          full_name: string
          id: string
          phone: string
          roles: string[]
          username: string
        }[]
      }
      admin_list_group_members: {
        Args: { _group_id: string }
        Returns: {
          email: string
          full_name: string
          user_id: string
          username: string
        }[]
      }
      admin_list_lecture_course_users: {
        Args: { _course_id: string }
        Returns: {
          email: string
          full_name: string
          user_id: string
          username: string
        }[]
      }
      admin_list_role_members: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: {
          email: string
          full_name: string
          user_id: string
          username: string
        }[]
      }
      admin_list_spaces: {
        Args: never
        Returns: {
          chat_enabled: boolean
          color: string
          created_at: string
          decks: number
          description: string
          discoverable: boolean
          emoji: string
          id: string
          kind: string
          last_activity: string
          members: number
          messages: number
          name: string
          owner_email: string
          owner_id: string
          owner_name: string
          owner_username: string
        }[]
      }
      admin_marketing_stats: { Args: never; Returns: Json }
      admin_people_course_stats: {
        Args: never
        Returns: {
          course_id: string
          owners: number
          price: number
          revenue_cents: number
          title: string
        }[]
      }
      admin_people_directory: {
        Args: never
        Returns: {
          courses: number
          created_at: string
          email: string
          full_name: string
          id: string
          kit_expires_at: string
          kit_name: string
          kit_slug: string
          last_seen: string
          lock_reason: string
          lock_until: string
          locked_at: string
          login_count: number
          paid_cents: number
          phone: string
          plan_name: string
          plan_slug: string
          roles: string[]
          username: string
          verified: boolean
        }[]
      }
      admin_people_insights: { Args: never; Returns: Json }
      admin_people_online: {
        Args: never
        Returns: {
          email: string
          full_name: string
          last_seen_at: string
          minutes_active: number
          plan_name: string
          plan_slug: string
          started_at: string
          user_id: string
          username: string
        }[]
      }
      admin_people_overview: { Args: never; Returns: Json }
      admin_people_pulse: { Args: never; Returns: Json }
      admin_people_retention: {
        Args: never
        Returns: {
          cohort: string
          size: number
          w0: number
          w1: number
          w2: number
          w3: number
        }[]
      }
      admin_people_timeseries: {
        Args: { _days?: number }
        Returns: {
          active_users: number
          day: string
          logins: number
          signups: number
        }[]
      }
      admin_person_history: { Args: { _user_id: string }; Returns: Json }
      admin_revoke_lecture_course: {
        Args: { _course_id: string; _user_id: string }
        Returns: undefined
      }
      admin_revoke_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      admin_server_stats: { Args: never; Returns: Json }
      admin_space_action: {
        Args: {
          _action: string
          _reason?: string
          _space_id: string
          _target?: string
        }
        Returns: undefined
      }
      admin_space_deck_cards: {
        Args: { _deck_id: string }
        Returns: {
          back: string
          front: string
          group_name: string
          id: string
          sort: number
        }[]
      }
      admin_space_detail: { Args: { _space_id: string }; Returns: Json }
      admin_support_notify: {
        Args: never
        Returns: {
          notify_email: string
          notify_enabled: boolean
        }[]
      }
      admin_users_with_plans: {
        Args: never
        Returns: {
          created_at: string
          email: string
          full_name: string
          id: string
          kit_expires_at: string
          kit_name: string
          kit_slug: string
          last_seen: string
          plan_name: string
          plan_slug: string
          roles: string[]
          username: string
        }[]
      }
      bump_deck_saves: { Args: { _deck_id: string }; Returns: undefined }
      bump_usage: {
        Args: { _kind: string; _n?: number; _user_id: string }
        Returns: undefined
      }
      can_access_committee_subject: {
        Args: { _subject_id: string }
        Returns: boolean
      }
      can_manage_space: {
        Args: { _space_id: string; _user_id: string }
        Returns: boolean
      }
      claim_offer: {
        Args: { _code?: string; _offer_id: string }
        Returns: Json
      }
      claim_toolkit: { Args: { _code?: string }; Returns: Json }
      create_space: {
        Args: {
          _color: string
          _description: string
          _emoji: string
          _kind: string
          _name: string
        }
        Returns: string
      }
      deck_in_my_space: {
        Args: { _deck_id: string; _user_id: string }
        Returns: boolean
      }
      deck_rating_summary: {
        Args: { _deck_id: string; _space_id?: string }
        Returns: Json
      }
      effective_plan: { Args: { _user_id: string }; Returns: Json }
      effective_plan_slug: { Args: { _user_id: string }; Returns: string }
      ensure_lq_default_bucket: { Args: never; Returns: Json }
      get_course_real_counts: {
        Args: { _course_ids: string[] }
        Returns: {
          course_id: string
          questions_count: number
          subjects_count: number
        }[]
      }
      get_email_by_username: { Args: { _username: string }; Returns: string }
      get_subject_question_counts: {
        Args: { _subject_ids: string[] }
        Returns: {
          cnt: number
          subject_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      head_search_users: {
        Args: { _query: string }
        Returns: {
          email: string
          full_name: string
          id: string
          username: string
        }[]
      }
      is_space_member: {
        Args: { _space_id: string; _user_id: string }
        Returns: boolean
      }
      join_space_by_code: { Args: { _code: string }; Returns: string }
      mark_announcement_seen: {
        Args: { _clicked?: boolean; _id: string }
        Returns: undefined
      }
      merge_cap: { Args: { _a: number; _b: number }; Returns: number }
      my_announcements: {
        Args: never
        Returns: {
          accent: string
          active: boolean
          body: string
          button_href: string | null
          button_label: string | null
          created_at: string
          delay_seconds: number
          ends_at: string | null
          frequency: string
          href: string | null
          href_label: string | null
          id: string
          image_url: string | null
          paths: string[]
          pinned: boolean
          secondary_href: string | null
          secondary_label: string | null
          sort: number
          starts_at: string | null
          style: string
          title: string
          trigger: string
          updated_at: string
          urgent: boolean
        }[]
        SetofOptions: {
          from: "*"
          to: "site_announcements"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      my_plan_usage: { Args: never; Returns: Json }
      my_spaces: {
        Args: never
        Returns: {
          chat_enabled: boolean
          color: string
          decks: number
          description: string
          emoji: string
          id: string
          image_url: string
          kind: string
          members: number
          name: string
          owner_id: string
          role: string
        }[]
      }
      offers_list: { Args: never; Returns: Json }
      push_audience_count: { Args: { _group_ids: string[] }; Returns: number }
      push_audience_devices: {
        Args: { _group_ids: string[] }
        Returns: {
          auth: string
          endpoint: string
          lang: string
          p256dh: string
          user_id: string
        }[]
      }
      rate_deck: {
        Args: {
          _deck_id: string
          _note?: string
          _space_id?: string
          _stars: number
        }
        Returns: undefined
      }
      revoke_golden_user: { Args: { _user_id: string }; Returns: undefined }
      save_lq_generation: {
        Args: {
          _difficulty: string
          _key_points: Json
          _lecture_id?: string
          _questions: Json
          _source_name: string
          _subtopic_id: string
          _title: string
        }
        Returns: string
      }
      search_users_for_group: {
        Args: { _exclude: string; _query: string }
        Returns: {
          email: string
          full_name: string
          id: string
          username: string
        }[]
      }
      space_can_add_decks: {
        Args: { _space_id: string; _user_id: string }
        Returns: boolean
      }
      space_can_post: {
        Args: { _space_id: string; _user_id: string }
        Returns: boolean
      }
      space_chat_on: { Args: { _space_id: string }; Returns: boolean }
      space_members_view: {
        Args: { _space_id: string }
        Returns: {
          avatar_url: string
          full_name: string
          joined_at: string
          role: string
          user_id: string
          username: string
        }[]
      }
      space_preview: { Args: { _code: string }; Returns: Json }
      space_role: {
        Args: { _space_id: string; _user_id: string }
        Returns: string
      }
      sync_golden_user: { Args: { _user_id: string }; Returns: undefined }
      toolkit_offer: { Args: never; Returns: Json }
      user_in_group: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      user_owns_any_german_course: {
        Args: { _user_id: string }
        Returns: boolean
      }
      vault_tables: {
        Args: never
        Returns: {
          depth: number
          name: string
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "user" | "committee" | "golden" | "committee_head"
      coupon_discount_type: "percent" | "fixed"
      package_type: "individual" | "group"
      subject_access: "paid" | "free_logged_in" | "free_public"
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
      app_role: ["admin", "user", "committee", "golden", "committee_head"],
      coupon_discount_type: ["percent", "fixed"],
      package_type: ["individual", "group"],
      subject_access: ["paid", "free_logged_in", "free_public"],
    },
  },
} as const
