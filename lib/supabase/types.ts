export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          email: string | null;
          avatar_url: string | null;
          role: "admin" | "project_manager" | "member";
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          role?: "admin" | "project_manager" | "member";
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          email?: string | null;
          avatar_url?: string | null;
          role?: "admin" | "project_manager" | "member";
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          legacy_project_id: string | null;
          name: string;
          manager_id: string | null;
          manager_name: string | null;
          path: string | null;
          current_stage: string | null;
          status: "active" | "paused" | "completed" | "cancelled";
          start_date: string | null;
          end_date: string | null;
          total_budget: number | null;
          description: string | null;
          logo_url: string | null;
          progress: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_project_id?: string | null;
          name?: string;
          manager_id?: string | null;
          manager_name?: string | null;
          path?: string | null;
          current_stage?: string | null;
          status?: "active" | "paused" | "completed" | "cancelled";
          start_date?: string | null;
          end_date?: string | null;
          total_budget?: number | null;
          description?: string | null;
          logo_url?: string | null;
          progress?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          legacy_project_id?: string | null;
          name?: string;
          manager_id?: string | null;
          manager_name?: string | null;
          path?: string | null;
          current_stage?: string | null;
          status?: "active" | "paused" | "completed" | "cancelled";
          start_date?: string | null;
          end_date?: string | null;
          total_budget?: number | null;
          description?: string | null;
          logo_url?: string | null;
          progress?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      project_members: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          role_in_project: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string;
          user_id?: string;
          role_in_project?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          role_in_project?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          legacy_task_id: string | null;
          project_id: string;
          title: string;
          sub_task: string | null;
          category: string | null;
          owner_id: string | null;
          owner_name: string | null;
          status: "Backlog" | "To Do" | "In Progress" | "Review" | "Done" | "Cancelled";
          board_column: string;
          priority: "low" | "medium" | "high" | "critical";
          start_date: string | null;
          due_date: string | null;
          cost: number | null;
          quantity_total: number | null;
          quantity_done: number | null;
          progress: number | null;
          schedule_status: string | null;
          alert_level: "Low" | "Medium" | "High" | "Critical" | null;
          alert_message: string | null;
          alert_action: string | null;
          days_to_due: number | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          legacy_task_id?: string | null;
          project_id?: string;
          title?: string;
          sub_task?: string | null;
          category?: string | null;
          owner_id?: string | null;
          owner_name?: string | null;
          status?: "Backlog" | "To Do" | "In Progress" | "Review" | "Done" | "Cancelled";
          board_column?: string;
          priority?: "low" | "medium" | "high" | "critical";
          start_date?: string | null;
          due_date?: string | null;
          cost?: number | null;
          quantity_total?: number | null;
          quantity_done?: number | null;
          progress?: number | null;
          schedule_status?: string | null;
          alert_level?: "Low" | "Medium" | "High" | "Critical" | null;
          alert_message?: string | null;
          alert_action?: string | null;
          days_to_due?: number | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          legacy_task_id?: string | null;
          project_id?: string;
          title?: string;
          sub_task?: string | null;
          category?: string | null;
          owner_id?: string | null;
          owner_name?: string | null;
          status?: "Backlog" | "To Do" | "In Progress" | "Review" | "Done" | "Cancelled";
          board_column?: string;
          priority?: "low" | "medium" | "high" | "critical";
          start_date?: string | null;
          due_date?: string | null;
          cost?: number | null;
          quantity_total?: number | null;
          quantity_done?: number | null;
          progress?: number | null;
          schedule_status?: string | null;
          alert_level?: "Low" | "Medium" | "High" | "Critical" | null;
          alert_message?: string | null;
          alert_action?: string | null;
          days_to_due?: number | null;
          sort_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      challenges: {
        Row: {
          id: string;
          project_id: string;
          task_id: string | null;
          title: string;
          description: string | null;
          status: "open" | "in_progress" | "resolved" | "closed";
          owner_id: string | null;
          risk_impact: string | null;
          risk_type: string | null;
          resolution: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string;
          task_id?: string | null;
          title?: string;
          description?: string | null;
          status?: "open" | "in_progress" | "resolved" | "closed";
          owner_id?: string | null;
          risk_impact?: string | null;
          risk_type?: string | null;
          resolution?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          task_id?: string | null;
          title?: string;
          description?: string | null;
          status?: "open" | "in_progress" | "resolved" | "closed";
          owner_id?: string | null;
          risk_impact?: string | null;
          risk_type?: string | null;
          resolution?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          project_id: string;
          task_id: string | null;
          title: string;
          url: string | null;
          file_path: string | null;
          type: string | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id?: string;
          task_id?: string | null;
          title?: string;
          url?: string | null;
          file_path?: string | null;
          type?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          task_id?: string | null;
          title?: string;
          url?: string | null;
          file_path?: string | null;
          type?: string | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      comments: {
        Row: {
          id: string;
          task_id: string;
          user_id: string | null;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          task_id?: string;
          user_id?: string | null;
          body?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          user_id?: string | null;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          task_id: string | null;
          type: string | null;
          title: string | null;
          body: string | null;
          sent_via: string | null;
          sent_at: string | null;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          task_id?: string | null;
          type?: string | null;
          title?: string | null;
          body?: string | null;
          sent_via?: string | null;
          sent_at?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          task_id?: string | null;
          type?: string | null;
          title?: string | null;
          body?: string | null;
          sent_via?: string | null;
          sent_at?: string | null;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      automation_logs: {
        Row: {
          id: string;
          type: string | null;
          status: string | null;
          payload: Json | null;
          error: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          type?: string | null;
          status?: string | null;
          payload?: Json | null;
          error?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: string | null;
          status?: string | null;
          payload?: Json | null;
          error?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      project_templates: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          category: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          name?: string;
          description?: string | null;
          category?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          category?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      task_templates: {
        Row: {
          id: string;
          template_id: string;
          title: string;
          sub_task: string | null;
          category: string | null;
          default_duration_days: number | null;
          default_priority: string;
          sort_order: number;
        };
        Insert: {
          id?: string;
          template_id?: string;
          title?: string;
          sub_task?: string | null;
          category?: string | null;
          default_duration_days?: number | null;
          default_priority?: string;
          sort_order?: number;
        };
        Update: {
          id?: string;
          template_id?: string;
          title?: string;
          sub_task?: string | null;
          category?: string | null;
          default_duration_days?: number | null;
          default_priority?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
};

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Project = Database["public"]["Tables"]["projects"]["Row"];
export type ProjectMember = Database["public"]["Tables"]["project_members"]["Row"];
export type Task = Database["public"]["Tables"]["tasks"]["Row"];
export type Challenge = Database["public"]["Tables"]["challenges"]["Row"];
export type Document = Database["public"]["Tables"]["documents"]["Row"];
export type Comment = Database["public"]["Tables"]["comments"]["Row"];
export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type AutomationLog = Database["public"]["Tables"]["automation_logs"]["Row"];
export type ProjectTemplate = Database["public"]["Tables"]["project_templates"]["Row"];
export type TaskTemplate = Database["public"]["Tables"]["task_templates"]["Row"];
