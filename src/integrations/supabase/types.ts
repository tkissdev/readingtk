export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      chapters: {
        Row: {
          chapter_label: string;
          chapter_url: string;
          detected_at: string;
          id: string;
          published_at: string | null;
          site_id: string | null;
          title_id: string;
        };
        Insert: {
          chapter_label: string;
          chapter_url: string;
          detected_at?: string;
          id?: string;
          published_at?: string | null;
          site_id?: string | null;
          title_id: string;
        };
        Update: {
          chapter_label?: string;
          chapter_url?: string;
          detected_at?: string;
          id?: string;
          published_at?: string | null;
          site_id?: string | null;
          title_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chapters_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chapters_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      imports: {
        Row: {
          created_at: string;
          id: string;
          raw_json: Json | null;
          source: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          raw_json?: Json | null;
          source?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          raw_json?: Json | null;
          source?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "imports_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          channel: string;
          chapter_id: string;
          created_at: string;
          id: string;
          read_at: string | null;
          sent_at: string | null;
          title_id: string;
          user_id: string;
        };
        Insert: {
          channel?: string;
          chapter_id: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          sent_at?: string | null;
          title_id: string;
          user_id: string;
        };
        Update: {
          channel?: string;
          chapter_id?: string;
          created_at?: string;
          id?: string;
          read_at?: string | null;
          sent_at?: string | null;
          title_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_chapter_id_fkey";
            columns: ["chapter_id"];
            isOneToOne: false;
            referencedRelation: "chapters";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          id: string;
        };
        Insert: {
          created_at?: string;
          id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
        };
        Relationships: [];
      };
      reading_progress: {
        Row: {
          id: string;
          last_chapter_read: string | null;
          last_read_at: string;
          notes: string | null;
          title_id: string;
        };
        Insert: {
          id?: string;
          last_chapter_read?: string | null;
          last_read_at?: string;
          notes?: string | null;
          title_id: string;
        };
        Update: {
          id?: string;
          last_chapter_read?: string | null;
          last_read_at?: string;
          notes?: string | null;
          title_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reading_progress_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: true;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      release_schedules: {
        Row: {
          color: string | null;
          created_at: string;
          day_of_week: number;
          id: string;
          label: string | null;
          manual: boolean;
          release_time: string;
          title_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          day_of_week: number;
          id?: string;
          label?: string | null;
          manual?: boolean;
          release_time?: string;
          title_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          day_of_week?: number;
          id?: string;
          label?: string | null;
          manual?: boolean;
          release_time?: string;
          title_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "release_schedules_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "release_schedules_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      sites: {
        Row: {
          base_url: string;
          created_at: string;
          enabled: boolean;
          id: string;
          is_down: boolean | null;
          name: string;
          needs_tab: boolean | null;
          priority: number;
          url_template: string | null;
          user_id: string;
        };
        Insert: {
          base_url: string;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          is_down?: boolean | null;
          name: string;
          needs_tab?: boolean | null;
          priority?: number;
          url_template?: string | null;
          user_id: string;
        };
        Update: {
          base_url?: string;
          created_at?: string;
          enabled?: boolean;
          id?: string;
          is_down?: boolean | null;
          name?: string;
          needs_tab?: boolean | null;
          priority?: number;
          url_template?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sites_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      title_sources: {
        Row: {
          created_at: string;
          id: string;
          is_primary: boolean;
          last_error: string | null;
          last_seen_chapter: string | null;
          site_id: string | null;
          title_id: string;
          url: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          last_error?: string | null;
          last_seen_chapter?: string | null;
          site_id?: string | null;
          title_id: string;
          url: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_primary?: boolean;
          last_error?: string | null;
          last_seen_chapter?: string | null;
          site_id?: string | null;
          title_id?: string;
          url?: string;
        };
        Relationships: [
          {
            foreignKeyName: "title_sources_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sites";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "title_sources_title_id_fkey";
            columns: ["title_id"];
            isOneToOne: false;
            referencedRelation: "titles";
            referencedColumns: ["id"];
          },
        ];
      };
      titles: {
        Row: {
          aliases: string[] | null;
          cover_url: string | null;
          created_at: string;
          id: string;
          name: string;
          status: string | null;
          type: string | null;
          user_id: string;
        };
        Insert: {
          aliases?: string[] | null;
          cover_url?: string | null;
          created_at?: string;
          id?: string;
          name: string;
          status?: string | null;
          type?: string | null;
          user_id: string;
        };
        Update: {
          aliases?: string[] | null;
          cover_url?: string | null;
          created_at?: string;
          id?: string;
          name?: string;
          status?: string | null;
          type?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "titles_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_settings: {
        Row: {
          bookmarks_domain_whitelist: string[] | null;
          bookmarks_group_by_domain: boolean;
          bookmarks_ignore_duplicates: boolean;
          chapter_format: string;
          check_frequency_hours: number | null;
          default_status: string;
          default_type: string;
          email_notifications_enabled: boolean;
          in_app_notifications_enabled: boolean;
          last_global_check_at: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          bookmarks_domain_whitelist?: string[] | null;
          bookmarks_group_by_domain?: boolean;
          bookmarks_ignore_duplicates?: boolean;
          chapter_format?: string;
          check_frequency_hours?: number | null;
          default_status?: string;
          default_type?: string;
          email_notifications_enabled?: boolean;
          in_app_notifications_enabled?: boolean;
          last_global_check_at?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          bookmarks_domain_whitelist?: string[] | null;
          bookmarks_group_by_domain?: boolean;
          bookmarks_ignore_duplicates?: boolean;
          chapter_format?: string;
          check_frequency_hours?: number | null;
          default_status?: string;
          default_type?: string;
          email_notifications_enabled?: boolean;
          in_app_notifications_enabled?: boolean;
          last_global_check_at?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      owns_title: { Args: { _title_id: string }; Returns: boolean };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
