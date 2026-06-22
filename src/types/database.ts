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
      contract_deliverables: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          project_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          project_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          project_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contract_deliverables_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          deleted_at: string | null
          id: string
          level: number | null
          name: string
          parent_id: string | null
        }
        Insert: {
          code: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          level?: number | null
          name: string
          parent_id?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          level?: number | null
          name?: string
          parent_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "departments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      file_comments: {
        Row: {
          content: string
          created_at: string | null
          deleted_at: string | null
          deleted_by: string | null
          file_id: string
          id: string
          is_public: boolean | null
          parent_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          file_id: string
          id?: string
          is_public?: boolean | null
          parent_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          file_id?: string
          id?: string
          is_public?: boolean | null
          parent_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_comments_deleted_by_fkey"
            columns: ["deleted_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_comments_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "file_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      file_download_record: {
        Row: {
          created_at: string
          downloaded_at: string | null
          file_id: string | null
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          downloaded_at?: string | null
          file_id?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          downloaded_at?: string | null
          file_id?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_download_record_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_download_record_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      file_interactions: {
        Row: {
          created_at: string | null
          file_id: string
          id: string
          interaction_type: string
          user_id: string
          user_role_at_time: string | null
        }
        Insert: {
          created_at?: string | null
          file_id: string
          id?: string
          interaction_type: string
          user_id: string
          user_role_at_time?: string | null
        }
        Update: {
          created_at?: string | null
          file_id?: string
          id?: string
          interaction_type?: string
          user_id?: string
          user_role_at_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_interactions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      file_process_tasks: {
        Row: {
          completed_at: string | null
          created_at: string | null
          error_msg: string | null
          file_id: string
          id: string
          result_data: Json | null
          started_at: string | null
          status: Database["public"]["Enums"]["file_process_status"] | null
          task_type: Database["public"]["Enums"]["file_process_task_type"]
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          error_msg?: string | null
          file_id: string
          id?: string
          result_data?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["file_process_status"] | null
          task_type: Database["public"]["Enums"]["file_process_task_type"]
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          error_msg?: string | null
          file_id?: string
          id?: string
          result_data?: Json | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["file_process_status"] | null
          task_type?: Database["public"]["Enums"]["file_process_task_type"]
        }
        Relationships: [
          {
            foreignKeyName: "file_process_tasks_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      file_reference_links: {
        Row: {
          deliverable_file_id: string
          id: string
          reference_file_id: string
        }
        Insert: {
          deliverable_file_id: string
          id?: string
          reference_file_id: string
        }
        Update: {
          deliverable_file_id?: string
          id?: string
          reference_file_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_reference_links_deliverable_file_id_fkey"
            columns: ["deliverable_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_reference_links_reference_file_id_fkey"
            columns: ["reference_file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          contract_deliverable_id: string | null
          created_at: string | null
          extract_status: string | null
          file_ext: string | null
          file_name: string
          file_size: number
          file_source: Database["public"]["Enums"]["file_source_type"] | null
          id: string
          is_confidential: boolean | null
          is_deliverable: boolean | null
          is_latest: boolean | null
          mime_type: string | null
          preview_status:
            | Database["public"]["Enums"]["file_preview_status"]
            | null
          preview_storage_key: string | null
          project_id: string
          source_storage_key: string
          updated_at: string | null
          uploader_id: string
          version_group_id: string
          version_label: string | null
          version_no: number
        }
        Insert: {
          contract_deliverable_id?: string | null
          created_at?: string | null
          extract_status?: string | null
          file_ext?: string | null
          file_name: string
          file_size: number
          file_source?: Database["public"]["Enums"]["file_source_type"] | null
          id?: string
          is_confidential?: boolean | null
          is_deliverable?: boolean | null
          is_latest?: boolean | null
          mime_type?: string | null
          preview_status?:
            | Database["public"]["Enums"]["file_preview_status"]
            | null
          preview_storage_key?: string | null
          project_id: string
          source_storage_key: string
          updated_at?: string | null
          uploader_id: string
          version_group_id: string
          version_label?: string | null
          version_no?: number
        }
        Update: {
          contract_deliverable_id?: string | null
          created_at?: string | null
          extract_status?: string | null
          file_ext?: string | null
          file_name?: string
          file_size?: number
          file_source?: Database["public"]["Enums"]["file_source_type"] | null
          id?: string
          is_confidential?: boolean | null
          is_deliverable?: boolean | null
          is_latest?: boolean | null
          mime_type?: string | null
          preview_status?:
            | Database["public"]["Enums"]["file_preview_status"]
            | null
          preview_storage_key?: string | null
          project_id?: string
          source_storage_key?: string
          updated_at?: string | null
          uploader_id?: string
          version_group_id?: string
          version_label?: string | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "files_contract_deliverable_id_fkey"
            columns: ["contract_deliverable_id"]
            isOneToOne: false
            referencedRelation: "contract_deliverables"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_uploader_id_fkey"
            columns: ["uploader_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_read: boolean
          meta: Json
          sender_id: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id: string
          is_read?: boolean
          meta?: Json
          sender_id?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_read?: boolean
          meta?: Json
          sender_id?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
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
      project_members: {
        Row: {
          created_at: string
          deleted_at: string | null
          id: string
          project_id: string | null
          project_role: Database["public"]["Enums"]["project_roles"] | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          project_id?: string | null
          project_role?: Database["public"]["Enums"]["project_roles"] | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          id?: string
          project_id?: string | null
          project_role?: Database["public"]["Enums"]["project_roles"] | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "project_members_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      project_week_exemptions: {
        Row: {
          created_at: string
          created_by: string
          end_week_code: string | null
          id: string
          project_id: string
          reason: string | null
          start_week_code: string
        }
        Insert: {
          created_at?: string
          created_by: string
          end_week_code?: string | null
          id?: string
          project_id: string
          reason?: string | null
          start_week_code: string
        }
        Update: {
          created_at?: string
          created_by?: string
          end_week_code?: string | null
          id?: string
          project_id?: string
          reason?: string | null
          start_week_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_week_exemptions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_week_exemptions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          business_type: string | null
          contract_no: string | null
          created_at: string
          customer_name: string | null
          deleted_at: string | null
          department_id: string | null
          end_date: string | null
          fiscal_year: string | null
          id: string
          industry_category: string | null
          product_block: string | null
          project_introduction: string | null
          project_name: string | null
          project_no: string | null
          project_stage: Database["public"]["Enums"]["project_stage"]
          project_status: Database["public"]["Enums"]["project_status"] | null
          start_date: string | null
        }
        Insert: {
          business_type?: string | null
          contract_no?: string | null
          created_at?: string
          customer_name?: string | null
          deleted_at?: string | null
          department_id?: string | null
          end_date?: string | null
          fiscal_year?: string | null
          id?: string
          industry_category?: string | null
          product_block?: string | null
          project_introduction?: string | null
          project_name?: string | null
          project_no?: string | null
          project_stage?: Database["public"]["Enums"]["project_stage"]
          project_status?: Database["public"]["Enums"]["project_status"] | null
          start_date?: string | null
        }
        Update: {
          business_type?: string | null
          contract_no?: string | null
          created_at?: string
          customer_name?: string | null
          deleted_at?: string | null
          department_id?: string | null
          end_date?: string | null
          fiscal_year?: string | null
          id?: string
          industry_category?: string | null
          product_block?: string | null
          project_introduction?: string | null
          project_name?: string | null
          project_no?: string | null
          project_stage?: Database["public"]["Enums"]["project_stage"]
          project_status?: Database["public"]["Enums"]["project_status"] | null
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          auth_id: string | null
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          department_id: string | null
          email: string | null
          employee_no: string | null
          gender: string | null
          id: string
          name: string | null
          position: string | null
          role: Database["public"]["Enums"]["system_roles"] | null
        }
        Insert: {
          auth_id?: string | null
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          department_id?: string | null
          email?: string | null
          employee_no?: string | null
          gender?: string | null
          id?: string
          name?: string | null
          position?: string | null
          role?: Database["public"]["Enums"]["system_roles"] | null
        }
        Update: {
          auth_id?: string | null
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          department_id?: string | null
          email?: string | null
          employee_no?: string | null
          gender?: string | null
          id?: string
          name?: string | null
          position?: string | null
          role?: Database["public"]["Enums"]["system_roles"] | null
        }
        Relationships: [
          {
            foreignKeyName: "users_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_report_approvals: {
        Row: {
          action: Database["public"]["Enums"]["weekly_report_action"]
          approved_at: string | null
          approver_id: string
          created_at: string
          id: string
          is_overdue: boolean
          reject_reason: string | null
          report_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["weekly_report_action"]
          approved_at?: string | null
          approver_id: string
          created_at?: string
          id?: string
          is_overdue?: boolean
          reject_reason?: string | null
          report_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["weekly_report_action"]
          approved_at?: string | null
          approver_id?: string
          created_at?: string
          id?: string
          is_overdue?: boolean
          reject_reason?: string | null
          report_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_report_approvals_approver_id_fkey"
            columns: ["approver_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_report_file_links: {
        Row: {
          created_at: string
          file_id: string
          id: string
          report_item_id: string
        }
        Insert: {
          created_at?: string
          file_id: string
          id?: string
          report_item_id: string
        }
        Update: {
          created_at?: string
          file_id?: string
          id?: string
          report_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_report_file_links_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_report_items: {
        Row: {
          created_at: string
          id: string
          item_desc: string | null
          item_type: Database["public"]["Enums"]["weekly_report_item_type"]
          report_id: string
          sort_order: number | null
          updated_at: string
          work_dates: Json | null
          work_days: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          item_desc?: string | null
          item_type?: Database["public"]["Enums"]["weekly_report_item_type"]
          report_id: string
          sort_order?: number | null
          updated_at?: string
          work_dates?: Json | null
          work_days?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          item_desc?: string | null
          item_type?: Database["public"]["Enums"]["weekly_report_item_type"]
          report_id?: string
          sort_order?: number | null
          updated_at?: string
          work_dates?: Json | null
          work_days?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "weekly_report_items_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "weekly_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      weekly_reports: {
        Row: {
          created_at: string
          id: string
          is_overdue: boolean
          project_id: string
          status: Database["public"]["Enums"]["weekly_report_status"]
          submit_time: string | null
          updated_at: string
          user_id: string
          week_code: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_overdue?: boolean
          project_id: string
          status?: Database["public"]["Enums"]["weekly_report_status"]
          submit_time?: string | null
          updated_at?: string
          user_id: string
          week_code: string
        }
        Update: {
          created_at?: string
          id?: string
          is_overdue?: boolean
          project_id?: string
          status?: Database["public"]["Enums"]["weekly_report_status"]
          submit_time?: string | null
          updated_at?: string
          user_id?: string
          week_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "weekly_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "weekly_reports_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      weeks: {
        Row: {
          created_at: string
          deadline: string | null
          end_date: string
          id: string
          is_locked: boolean
          start_date: string
          updated_at: string
          week_code: string
          week_no: number
          year: number
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          end_date: string
          id?: string
          is_locked?: boolean
          start_date: string
          updated_at?: string
          week_code: string
          week_no: number
          year: number
        }
        Update: {
          created_at?: string
          deadline?: string | null
          end_date?: string
          id?: string
          is_locked?: boolean
          start_date?: string
          updated_at?: string
          week_code?: string
          week_no?: number
          year?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      file_preview_status: "pending" | "processing" | "success" | "failure"
      file_process_status: "pending" | "processing" | "success" | "failure"
      file_process_task_type:
        | "duplicate_check"
        | "preview_generate"
        | "parse"
        | "index"
        | "vectorize"
      file_source_type: "client" | "internal" | "public" | "original"
      project_roles: "pm" | "member" | "director" | "sale_ld"
      project_stage: "实施阶段" | "销售阶段"
      project_status:
        | "active"
        | "preparing"
        | "completed"
        | "archived"
        | "suspended"
      system_roles: "user" | "dept_ld" | "dept_admin" | "admin"
      weekly_report_action: "approve" | "reject"
      weekly_report_item_type: "work" | "plan"
      weekly_report_status: "draft" | "pending" | "approved" | "rejected"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      file_preview_status: ["pending", "processing", "success", "failure"],
      file_process_status: ["pending", "processing", "success", "failure"],
      file_process_task_type: [
        "duplicate_check",
        "preview_generate",
        "parse",
        "index",
        "vectorize",
      ],
      file_source_type: ["client", "internal", "public", "original"],
      project_roles: ["pm", "member", "director", "sale_ld"],
      project_stage: ["实施阶段", "销售阶段"],
      project_status: [
        "active",
        "preparing",
        "completed",
        "archived",
        "suspended",
      ],
      system_roles: ["user", "dept_ld", "dept_admin", "admin"],
      weekly_report_action: ["approve", "reject"],
      weekly_report_item_type: ["work", "plan"],
      weekly_report_status: ["draft", "pending", "approved", "rejected"],
    },
  },
} as const

