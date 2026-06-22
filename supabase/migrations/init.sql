


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."file_preview_status" AS ENUM (
    'pending',
    'processing',
    'success',
    'failure'
);


ALTER TYPE "public"."file_preview_status" OWNER TO "supabase_admin";


CREATE TYPE "public"."file_process_status" AS ENUM (
    'pending',
    'processing',
    'success',
    'failure'
);


ALTER TYPE "public"."file_process_status" OWNER TO "supabase_admin";


CREATE TYPE "public"."file_process_task_type" AS ENUM (
    'duplicate_check',
    'preview_generate',
    'parse',
    'index',
    'vectorize'
);


ALTER TYPE "public"."file_process_task_type" OWNER TO "supabase_admin";


CREATE TYPE "public"."file_source_type" AS ENUM (
    'client',
    'internal',
    'public',
    'original'
);


ALTER TYPE "public"."file_source_type" OWNER TO "supabase_admin";


CREATE TYPE "public"."project_roles" AS ENUM (
    'pm',
    'member',
    'director',
    'sale_ld'
);


ALTER TYPE "public"."project_roles" OWNER TO "supabase_admin";


COMMENT ON TYPE "public"."project_roles" IS '项目角色';



CREATE TYPE "public"."project_stage" AS ENUM (
    '实施阶段',
    '销售阶段'
);


ALTER TYPE "public"."project_stage" OWNER TO "supabase_admin";


COMMENT ON TYPE "public"."project_stage" IS '项目阶段';



CREATE TYPE "public"."project_status" AS ENUM (
    'active',
    'preparing',
    'completed',
    'archived',
    'suspended'
);


ALTER TYPE "public"."project_status" OWNER TO "supabase_admin";


COMMENT ON TYPE "public"."project_status" IS '项目状态';



CREATE TYPE "public"."system_roles" AS ENUM (
    'user',
    'dept_ld',
    'dept_admin',
    'admin'
);


ALTER TYPE "public"."system_roles" OWNER TO "supabase_admin";


COMMENT ON TYPE "public"."system_roles" IS '系统角色';



CREATE TYPE "public"."weekly_report_action" AS ENUM (
    'approve',
    'reject'
);


ALTER TYPE "public"."weekly_report_action" OWNER TO "supabase_admin";


CREATE TYPE "public"."weekly_report_item_type" AS ENUM (
    'work',
    'plan'
);


ALTER TYPE "public"."weekly_report_item_type" OWNER TO "supabase_admin";


COMMENT ON TYPE "public"."weekly_report_item_type" IS '周报工作事项类型';



CREATE TYPE "public"."weekly_report_status" AS ENUM (
    'draft',
    'pending',
    'approved',
    'rejected'
);


ALTER TYPE "public"."weekly_report_status" OWNER TO "supabase_admin";


COMMENT ON TYPE "public"."weekly_report_status" IS '周报状态';



CREATE OR REPLACE FUNCTION "public"."enqueue_file_processor_task"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pgmq'
    AS $$
DECLARE
  msg_id bigint;
  v_uploader_name text;
  v_dept_id uuid;
  v_dept_name text;
  v_project_name text;
  v_file_type_label text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT u.name, u.department_id, dep.name, pr.project_name
    INTO v_uploader_name, v_dept_id, v_dept_name, v_project_name
    FROM public.users u
    LEFT JOIN public.departments dep
      ON dep.id = u.department_id AND dep.deleted_at IS NULL
    LEFT JOIN public.projects pr
      ON pr.id = NEW.project_id AND pr.deleted_at IS NULL
    WHERE u.id = NEW.uploader_id;

    v_file_type_label := CASE
      WHEN NEW.file_source = 'client'::public.file_source_type THEN 'reference_client'
      WHEN NEW.file_source = 'internal'::public.file_source_type THEN 'reference_internal'
      WHEN NEW.file_source = 'public'::public.file_source_type THEN 'reference_public'
      WHEN NEW.file_source = 'original'::public.file_source_type THEN 'deliverable'
      ELSE NULL
    END;

    SELECT pgmq.send(
      'file_processor_queue',
      jsonb_build_object(
        'file_id', NEW.id,
        'project_id', NEW.project_id,
        'project_name', v_project_name,
        'source_storage_key', NEW.source_storage_key,
        'file_name', NEW.file_name,
        'file_ext', NEW.file_ext,
        'created_at', NOW(),
        'uploader_id', NEW.uploader_id,
        'uploader_name', v_uploader_name,
        'department_id', v_dept_id,
        'department_name', v_dept_name,
        'file_type', v_file_type_label
      )
    ) INTO msg_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enqueue_file_processor_task"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "public"."enqueue_preview_task"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pgmq'
    AS $$
DECLARE
    -- 扩展支持 Excel 和 CSV
    allowed_exts TEXT[] := ARRAY[
        'doc', 'docx', 'ppt', 'pptx',  -- 转 PDF
        'xls', 'xlsx'            -- 解析 JSON
    ];
    msg_id BIGINT;
BEGIN
    IF NEW.file_ext = ANY(allowed_exts) AND NEW.preview_status = 'pending' THEN
        
        SELECT pgmq.send(
            'file_preview_queue',
            jsonb_build_object(
                'file_id', NEW.id,
                'project_id', NEW.project_id,
                'source_storage_key', NEW.source_storage_key,
                'file_name', NEW.file_name,
                'file_ext', NEW.file_ext,
                'created_at', NOW()
            )
        ) INTO msg_id;
        
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."enqueue_preview_task"() OWNER TO "supabase_admin";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "supabase_admin";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."contract_deliverables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "project_id" "uuid",
    "name" "text" NOT NULL,
    "description" "text"
);


ALTER TABLE "public"."contract_deliverables" OWNER TO "supabase_admin";


COMMENT ON TABLE "public"."contract_deliverables" IS '项目合同成果文件清单';



COMMENT ON COLUMN "public"."contract_deliverables"."project_id" IS '所属项目ID';



COMMENT ON COLUMN "public"."contract_deliverables"."name" IS '成果文件名称';



COMMENT ON COLUMN "public"."contract_deliverables"."description" IS '成果文件描述';



CREATE TABLE IF NOT EXISTS "public"."departments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" NOT NULL,
    "code" "text" NOT NULL,
    "parent_id" "uuid",
    "level" smallint,
    "deleted_at" timestamp with time zone,
    "leader_id" "uuid"
);


ALTER TABLE "public"."departments" OWNER TO "supabase_admin";


COMMENT ON TABLE "public"."departments" IS '部门表';



COMMENT ON COLUMN "public"."departments"."name" IS '部门名称';



COMMENT ON COLUMN "public"."departments"."code" IS '部门编码';



COMMENT ON COLUMN "public"."departments"."parent_id" IS '父部门ID';



COMMENT ON COLUMN "public"."departments"."level" IS '部门层级';



COMMENT ON COLUMN "public"."departments"."leader_id" IS '部门负责人用户ID';



CREATE TABLE IF NOT EXISTS "public"."file_comments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "parent_id" "uuid",
    "content" "text" NOT NULL,
    "is_public" boolean DEFAULT true,
    "deleted_at" timestamp with time zone,
    "deleted_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."file_comments" OWNER TO "supabase_admin";


COMMENT ON TABLE "public"."file_comments" IS '文件评论表';



COMMENT ON COLUMN "public"."file_comments"."file_id" IS '评论的文件ID';



COMMENT ON COLUMN "public"."file_comments"."user_id" IS '评论人用户ID';



COMMENT ON COLUMN "public"."file_comments"."parent_id" IS '父评论ID（回复用）';



COMMENT ON COLUMN "public"."file_comments"."content" IS '评论内容';



COMMENT ON COLUMN "public"."file_comments"."is_public" IS '是否公开';



COMMENT ON COLUMN "public"."file_comments"."deleted_by" IS '删除人用户ID';



CREATE TABLE IF NOT EXISTS "public"."file_download_record" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid",
    "file_id" "uuid",
    "downloaded_at" timestamp with time zone,
    "ip_address" "text"
);


ALTER TABLE "public"."file_download_record" OWNER TO "supabase_admin";


COMMENT ON TABLE "public"."file_download_record" IS '文件下载记录';



COMMENT ON COLUMN "public"."file_download_record"."user_id" IS '用户id';



COMMENT ON COLUMN "public"."file_download_record"."file_id" IS '文件id';



COMMENT ON COLUMN "public"."file_download_record"."downloaded_at" IS '下载时间';



COMMENT ON COLUMN "public"."file_download_record"."ip_address" IS 'ip地址';



CREATE TABLE IF NOT EXISTS "public"."file_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "file_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "user_role_at_time" "text",
    "interaction_type" "text" NOT NULL,
    CONSTRAINT "file_interactions_interaction_type_check" CHECK (("interaction_type" = ANY (ARRAY['favorite'::"text", 'recommend'::"text"])))
);


ALTER TABLE "public"."file_interactions" OWNER TO "supabase_admin";


COMMENT ON TABLE "public"."file_interactions" IS '文件互动表（点赞/收藏）';



COMMENT ON COLUMN "public"."file_interactions"."file_id" IS '互动的文件ID';



COMMENT ON COLUMN "public"."file_interactions"."user_id" IS '互动用户ID';



COMMENT ON COLUMN "public"."file_interactions"."user_role_at_time" IS '互动时用户角色';



COMMENT ON COLUMN "public"."file_interactions"."interaction_type" IS '互动类型：favorite收藏/recommend点赞';



CREATE TABLE IF NOT EXISTS "public"."file_process_tasks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_id" "uuid" NOT NULL,
    "task_type" "public"."file_process_task_type" NOT NULL,
    "status" "public"."file_process_status" DEFAULT 'pending'::"public"."file_process_status",
    "result_data" "jsonb",
    "error_msg" "text",
    "started_at" timestamp without time zone,
    "completed_at" timestamp without time zone,
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE "public"."file_process_tasks" OWNER TO "supabase_admin";


COMMENT ON TABLE "public"."file_process_tasks" IS '文件异步处理任务表';



COMMENT ON COLUMN "public"."file_process_tasks"."file_id" IS '处理的文件ID';



COMMENT ON COLUMN "public"."file_process_tasks"."task_type" IS '任务类型：duplicate_check重复检测/preview_generate预览生成/parse文件解析/index索引化/vectorize向量化';



COMMENT ON COLUMN "public"."file_process_tasks"."status" IS '任务状态';



COMMENT ON COLUMN "public"."file_process_tasks"."result_data" IS '任务结果JSON';



COMMENT ON COLUMN "public"."file_process_tasks"."error_msg" IS '错误信息';



COMMENT ON COLUMN "public"."file_process_tasks"."started_at" IS '开始处理时间';



COMMENT ON COLUMN "public"."file_process_tasks"."completed_at" IS '完成时间';



CREATE TABLE IF NOT EXISTS "public"."file_reference_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reference_file_id" "uuid" NOT NULL,
    "deliverable_file_id" "uuid" NOT NULL
);


ALTER TABLE "public"."file_reference_links" OWNER TO "supabase_admin";


COMMENT ON TABLE "public"."file_reference_links" IS '参考文件与成果文件关联表';



COMMENT ON COLUMN "public"."file_reference_links"."reference_file_id" IS '参考文件ID';



COMMENT ON COLUMN "public"."file_reference_links"."deliverable_file_id" IS '关联的成果文件ID';



CREATE TABLE IF NOT EXISTS "public"."files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "file_name" "text" NOT NULL,
    "file_size" bigint NOT NULL,
    "file_ext" "text",
    "mime_type" "text",
    "source_storage_key" "text" NOT NULL,
    "preview_storage_key" "text",
    "preview_status" "public"."file_preview_status" DEFAULT 'pending'::"public"."file_preview_status",
    "uploader_id" "uuid" NOT NULL,
    "version_group_id" "uuid" NOT NULL,
    "version_no" integer DEFAULT 1 NOT NULL,
    "version_label" "text",
    "is_latest" boolean DEFAULT true,
    "is_deliverable" boolean DEFAULT false,
    "contract_deliverable_id" "uuid",
    "file_source" "public"."file_source_type",
    "created_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "updated_at" timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    "is_confidential" boolean DEFAULT false,
    "extract_status" "text",
    CONSTRAINT "chk_version_no_positive" CHECK (("version_no" > 0))
);


ALTER TABLE "public"."files" OWNER TO "supabase_admin";


COMMENT ON TABLE "public"."files" IS '项目文件表';



COMMENT ON COLUMN "public"."files"."project_id" IS '所属项目ID';



COMMENT ON COLUMN "public"."files"."file_name" IS '文件名';



COMMENT ON COLUMN "public"."files"."file_size" IS '文件大小（字节）';



COMMENT ON COLUMN "public"."files"."file_ext" IS '文件扩展名';



COMMENT ON COLUMN "public"."files"."mime_type" IS 'MIME类型';



COMMENT ON COLUMN "public"."files"."source_storage_key" IS '源文件存储Key';



COMMENT ON COLUMN "public"."files"."preview_storage_key" IS '预览文件存储Key';



COMMENT ON COLUMN "public"."files"."preview_status" IS '预览生成状态';



COMMENT ON COLUMN "public"."files"."uploader_id" IS '上传人用户ID';



COMMENT ON COLUMN "public"."files"."version_group_id" IS '版本组ID';



COMMENT ON COLUMN "public"."files"."version_no" IS '版本序号';



COMMENT ON COLUMN "public"."files"."version_label" IS '版本显示名称（如v4.7）';



COMMENT ON COLUMN "public"."files"."is_latest" IS '是否为最新版本';



COMMENT ON COLUMN "public"."files"."is_deliverable" IS '是否为成果文件';



COMMENT ON COLUMN "public"."files"."contract_deliverable_id" IS '关联的合同成果清单ID';



COMMENT ON COLUMN "public"."files"."file_source" IS '文件来源：client客户资料/internal内部资料/public公开资料';



COMMENT ON COLUMN "public"."files"."is_confidential" IS '是否保密';



COMMENT ON COLUMN "public"."files"."extract_status" IS '文件解析状态';



CREATE TABLE IF NOT EXISTS "public"."notifications" (
    "id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "content" "text",
    "meta" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "is_read" boolean DEFAULT false NOT NULL,
    "sender_id" "uuid"
);


ALTER TABLE "public"."notifications" OWNER TO "supabase_admin";


COMMENT ON TABLE "public"."notifications" IS '消息通知表';



COMMENT ON COLUMN "public"."notifications"."user_id" IS '接收用户ID';



COMMENT ON COLUMN "public"."notifications"."type" IS '通知类型';



COMMENT ON COLUMN "public"."notifications"."title" IS '通知标题';



COMMENT ON COLUMN "public"."notifications"."content" IS '通知内容';



COMMENT ON COLUMN "public"."notifications"."meta" IS '扩展信息JSON';



COMMENT ON COLUMN "public"."notifications"."is_read" IS '是否已读';



COMMENT ON COLUMN "public"."notifications"."sender_id" IS '发送人用户ID';



CREATE TABLE IF NOT EXISTS "public"."project_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "project_id" "uuid",
    "user_id" "uuid",
    "project_role" "public"."project_roles" DEFAULT 'member'::"public"."project_roles"
);


ALTER TABLE "public"."project_members" OWNER TO "supabase_admin";


COMMENT ON TABLE "public"."project_members" IS '项目成员表';



COMMENT ON COLUMN "public"."project_members"."project_id" IS '所属项目ID';



COMMENT ON COLUMN "public"."project_members"."user_id" IS '用户ID';



COMMENT ON COLUMN "public"."project_members"."project_role" IS '项目角色：pm项目经理/member成员/director总监';



CREATE TABLE IF NOT EXISTS "public"."project_week_exemptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "start_week_code" "text" NOT NULL,
    "end_week_code" "text",
    "reason" "text",
    "created_by" "uuid" NOT NULL
);


ALTER TABLE "public"."project_week_exemptions" OWNER TO "supabase_admin";


COMMENT ON TABLE "public"."project_week_exemptions" IS '项目周报无工作表';



COMMENT ON COLUMN "public"."project_week_exemptions"."project_id" IS '豁免项目ID';



COMMENT ON COLUMN "public"."project_week_exemptions"."start_week_code" IS '豁免开始周次';



COMMENT ON COLUMN "public"."project_week_exemptions"."end_week_code" IS '豁免结束周次';



COMMENT ON COLUMN "public"."project_week_exemptions"."reason" IS '豁免原因';



COMMENT ON COLUMN "public"."project_week_exemptions"."created_by" IS '创建人用户ID';



CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deleted_at" timestamp with time zone,
    "project_no" "text",
    "project_name" "text",
    "project_status" "public"."project_status" DEFAULT 'preparing'::"public"."project_status",
    "project_stage" "public"."project_stage" DEFAULT '实施阶段'::"public"."project_stage" NOT NULL,
    "department_id" "uuid",
    "start_date" "text",
    "end_date" "text",
    "industry_category" "text",
    "customer_name" "text",
    "business_type" "text",
    "product_block" "text",
    "project_introduction" "text",
    "contract_no" "text",
    "fiscal_year" "text"
);


ALTER TABLE "public"."projects" OWNER TO "supabase_admin";


COMMENT ON TABLE "public"."projects" IS '项目表';



COMMENT ON COLUMN "public"."projects"."project_no" IS '项目编号';



COMMENT ON COLUMN "public"."projects"."project_name" IS '项目名称';



COMMENT ON COLUMN "public"."projects"."project_status" IS '项目状态';



COMMENT ON COLUMN "public"."projects"."project_stage" IS '项目阶段';



COMMENT ON COLUMN "public"."projects"."department_id" IS '所属部门ID';



COMMENT ON COLUMN "public"."projects"."start_date" IS '开始日期';



COMMENT ON COLUMN "public"."projects"."end_date" IS '结束日期';



COMMENT ON COLUMN "public"."projects"."industry_category" IS '行业分类';



COMMENT ON COLUMN "public"."projects"."customer_name" IS '客户名称';



COMMENT ON COLUMN "public"."projects"."business_type" IS '业务类型';



COMMENT ON COLUMN "public"."projects"."product_block" IS '产品板块';



COMMENT ON COLUMN "public"."projects"."project_introduction" IS '项目简介';



COMMENT ON COLUMN "public"."projects"."contract_no" IS '合同编号';



COMMENT ON COLUMN "public"."projects"."fiscal_year" IS '所属财年';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "auth_id" "uuid",
    "name" "text",
    "employee_no" "text",
    "email" character varying,
    "gender" "text",
    "position" "text",
    "department_id" "uuid",
    "avatar_url" "text",
    "deleted_at" timestamp without time zone,
    "role" "public"."system_roles" DEFAULT 'user'::"public"."system_roles"
);


ALTER TABLE "public"."users" OWNER TO "supabase_admin";


COMMENT ON TABLE "public"."users" IS '用户表';



COMMENT ON COLUMN "public"."users"."auth_id" IS 'Supabase Auth用户ID';



COMMENT ON COLUMN "public"."users"."name" IS '用户姓名';



COMMENT ON COLUMN "public"."users"."employee_no" IS '工号';



COMMENT ON COLUMN "public"."users"."email" IS '邮箱';



COMMENT ON COLUMN "public"."users"."gender" IS '性别';



COMMENT ON COLUMN "public"."users"."position" IS '职位';



COMMENT ON COLUMN "public"."users"."department_id" IS '所属部门ID';



COMMENT ON COLUMN "public"."users"."avatar_url" IS '头像URL';



COMMENT ON COLUMN "public"."users"."role" IS '系统角色：user普通用户/dept_ld部门领导/dept_admin部门管理员/admin超级管理员';



CREATE TABLE IF NOT EXISTS "public"."weekly_report_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "report_id" "uuid" NOT NULL,
    "approver_id" "uuid" NOT NULL,
    "action" "public"."weekly_report_action" NOT NULL,
    "reject_reason" "text",
    "approved_at" timestamp with time zone,
    "is_overdue" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."weekly_report_approvals" OWNER TO "supabase_admin";


COMMENT ON TABLE "public"."weekly_report_approvals" IS '周报审批记录表';



COMMENT ON COLUMN "public"."weekly_report_approvals"."report_id" IS '审批的周报ID';



COMMENT ON COLUMN "public"."weekly_report_approvals"."approver_id" IS '审批人用户ID';



COMMENT ON COLUMN "public"."weekly_report_approvals"."action" IS '审批操作：approve通过/reject退回';



COMMENT ON COLUMN "public"."weekly_report_approvals"."reject_reason" IS '退回原因';



COMMENT ON COLUMN "public"."weekly_report_approvals"."approved_at" IS '审批时间';



COMMENT ON COLUMN "public"."weekly_report_approvals"."is_overdue" IS '是否逾期审批';



CREATE TABLE IF NOT EXISTS "public"."weekly_report_file_links" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "report_item_id" "uuid" NOT NULL,
    "file_id" "uuid" NOT NULL
);


ALTER TABLE "public"."weekly_report_file_links" OWNER TO "supabase_admin";


COMMENT ON TABLE "public"."weekly_report_file_links" IS '周报事项与文件关联表';



COMMENT ON COLUMN "public"."weekly_report_file_links"."report_item_id" IS '周报事项ID';



COMMENT ON COLUMN "public"."weekly_report_file_links"."file_id" IS '关联的文件ID';



CREATE TABLE IF NOT EXISTS "public"."weekly_report_items" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "report_id" "uuid" NOT NULL,
    "item_type" "public"."weekly_report_item_type" DEFAULT 'work'::"public"."weekly_report_item_type" NOT NULL,
    "item_desc" "text",
    "work_days" numeric(4,1),
    "work_dates" "jsonb",
    "sort_order" smallint DEFAULT '0'::smallint
);


ALTER TABLE "public"."weekly_report_items" OWNER TO "supabase_admin";


COMMENT ON TABLE "public"."weekly_report_items" IS '周报工作事项明细表';



COMMENT ON COLUMN "public"."weekly_report_items"."report_id" IS '所属周报ID';



COMMENT ON COLUMN "public"."weekly_report_items"."item_type" IS '事项类型';



COMMENT ON COLUMN "public"."weekly_report_items"."item_desc" IS '事项描述';



COMMENT ON COLUMN "public"."weekly_report_items"."work_days" IS '工时（天数）';



COMMENT ON COLUMN "public"."weekly_report_items"."work_dates" IS '工作日期集合';



COMMENT ON COLUMN "public"."weekly_report_items"."sort_order" IS '排序';



CREATE TABLE IF NOT EXISTS "public"."weekly_reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "project_id" "uuid" NOT NULL,
    "week_code" "text" NOT NULL,
    "status" "public"."weekly_report_status" DEFAULT 'draft'::"public"."weekly_report_status" NOT NULL,
    "submit_time" timestamp with time zone,
    "is_overdue" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."weekly_reports" OWNER TO "supabase_admin";


COMMENT ON TABLE "public"."weekly_reports" IS '项目周报表';



COMMENT ON COLUMN "public"."weekly_reports"."user_id" IS '填写人用户ID';



COMMENT ON COLUMN "public"."weekly_reports"."project_id" IS '所属项目ID';



COMMENT ON COLUMN "public"."weekly_reports"."week_code" IS '周次编码';



COMMENT ON COLUMN "public"."weekly_reports"."status" IS '周报状态：draft草稿/pending待审批/approved已通过/rejected已退回';



COMMENT ON COLUMN "public"."weekly_reports"."submit_time" IS '提交时间';



COMMENT ON COLUMN "public"."weekly_reports"."is_overdue" IS '是否逾期提交';



CREATE TABLE IF NOT EXISTS "public"."weeks" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "year" integer NOT NULL,
    "week_no" integer NOT NULL,
    "week_code" "text" NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date" NOT NULL,
    "deadline" timestamp with time zone,
    "is_locked" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."weeks" OWNER TO "supabase_admin";


COMMENT ON TABLE "public"."weeks" IS '周次管理表';



COMMENT ON COLUMN "public"."weeks"."year" IS '年份';



COMMENT ON COLUMN "public"."weeks"."week_no" IS '周数';



COMMENT ON COLUMN "public"."weeks"."week_code" IS '周次编码';



COMMENT ON COLUMN "public"."weeks"."start_date" IS '周开始日期';



COMMENT ON COLUMN "public"."weeks"."end_date" IS '周结束日期';



COMMENT ON COLUMN "public"."weeks"."deadline" IS '周报截止时间';



COMMENT ON COLUMN "public"."weeks"."is_locked" IS '是否已锁定';



ALTER TABLE ONLY "public"."contract_deliverables"
    ADD CONSTRAINT "contract_deliverables_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."contract_deliverables"
    ADD CONSTRAINT "contract_deliverables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_code_key" UNIQUE ("code");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_comments"
    ADD CONSTRAINT "file_comments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_download_record"
    ADD CONSTRAINT "file_download_record_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_interactions"
    ADD CONSTRAINT "file_interactions_file_id_user_id_interaction_type_key" UNIQUE ("file_id", "user_id", "interaction_type");



ALTER TABLE ONLY "public"."file_interactions"
    ADD CONSTRAINT "file_interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_process_tasks"
    ADD CONSTRAINT "file_process_tasks_file_id_task_type_key" UNIQUE ("file_id", "task_type");



ALTER TABLE ONLY "public"."file_process_tasks"
    ADD CONSTRAINT "file_process_tasks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_reference_links"
    ADD CONSTRAINT "file_reference_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."file_reference_links"
    ADD CONSTRAINT "file_reference_links_reference_file_id_deliverable_file_id_key" UNIQUE ("reference_file_id", "deliverable_file_id");



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_week_exemptions"
    ADD CONSTRAINT "project_week_exemptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_contract_no_key" UNIQUE ("contract_no");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_id_key" UNIQUE ("auth_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_employee_no_key" UNIQUE ("employee_no");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_report_approvals"
    ADD CONSTRAINT "weekly_report_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_report_file_links"
    ADD CONSTRAINT "weekly_report_file_links_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_report_file_links"
    ADD CONSTRAINT "weekly_report_file_links_report_item_id_file_id_key" UNIQUE ("report_item_id", "file_id");



ALTER TABLE ONLY "public"."weekly_report_items"
    ADD CONSTRAINT "weekly_report_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_reports"
    ADD CONSTRAINT "weekly_reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weekly_reports"
    ADD CONSTRAINT "weekly_reports_user_id_project_id_week_code_key" UNIQUE ("user_id", "project_id", "week_code");



ALTER TABLE ONLY "public"."weeks"
    ADD CONSTRAINT "weeks_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."weeks"
    ADD CONSTRAINT "weeks_year_week_no_key" UNIQUE ("year", "week_no");



CREATE INDEX "idx_departments_parent_id" ON "public"."departments" USING "btree" ("parent_id") WHERE ("deleted_at" IS NULL);



CREATE INDEX "idx_files_project_id_latest" ON "public"."files" USING "btree" ("project_id", "is_latest") WHERE ("is_latest" = true);



CREATE INDEX "idx_files_version_group_id" ON "public"."files" USING "btree" ("version_group_id", "version_no");



CREATE INDEX "idx_notifications_userid_created_at" ON "public"."notifications" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_notifications_userid_is_read" ON "public"."notifications" USING "btree" ("user_id", "is_read");



CREATE OR REPLACE TRIGGER "trigger_file_preview_queue" AFTER INSERT ON "public"."files" FOR EACH ROW EXECUTE FUNCTION "public"."enqueue_preview_task"();



CREATE OR REPLACE TRIGGER "trigger_file_processor_queue" AFTER INSERT ON "public"."files" FOR EACH ROW EXECUTE FUNCTION "public"."enqueue_file_processor_task"();



ALTER TABLE ONLY "public"."contract_deliverables"
    ADD CONSTRAINT "contract_deliverables_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");



ALTER TABLE ONLY "public"."departments"
    ADD CONSTRAINT "departments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."departments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_comments"
    ADD CONSTRAINT "file_comments_deleted_by_fkey" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."file_comments"
    ADD CONSTRAINT "file_comments_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_comments"
    ADD CONSTRAINT "file_comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "public"."file_comments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_comments"
    ADD CONSTRAINT "file_comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_download_record"
    ADD CONSTRAINT "file_download_record_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_download_record"
    ADD CONSTRAINT "file_download_record_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_interactions"
    ADD CONSTRAINT "file_interactions_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_interactions"
    ADD CONSTRAINT "file_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_process_tasks"
    ADD CONSTRAINT "file_process_tasks_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_reference_links"
    ADD CONSTRAINT "file_reference_links_deliverable_file_id_fkey" FOREIGN KEY ("deliverable_file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."file_reference_links"
    ADD CONSTRAINT "file_reference_links_reference_file_id_fkey" FOREIGN KEY ("reference_file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_contract_deliverable_id_fkey" FOREIGN KEY ("contract_deliverable_id") REFERENCES "public"."contract_deliverables"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."files"
    ADD CONSTRAINT "files_uploader_id_fkey" FOREIGN KEY ("uploader_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notifications"
    ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id");



ALTER TABLE ONLY "public"."project_members"
    ADD CONSTRAINT "project_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."project_week_exemptions"
    ADD CONSTRAINT "project_week_exemptions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."project_week_exemptions"
    ADD CONSTRAINT "project_week_exemptions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_auth_id_fkey" FOREIGN KEY ("auth_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE SET DEFAULT;



ALTER TABLE ONLY "public"."weekly_report_approvals"
    ADD CONSTRAINT "weekly_report_approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."weekly_report_file_links"
    ADD CONSTRAINT "weekly_report_file_links_file_id_fkey" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_report_items"
    ADD CONSTRAINT "weekly_report_items_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."weekly_reports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_reports"
    ADD CONSTRAINT "weekly_reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."weekly_reports"
    ADD CONSTRAINT "weekly_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."contract_deliverables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."departments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."file_comments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."file_download_record" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."file_interactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."file_process_tasks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."file_reference_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."files" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_week_exemptions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_report_approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_report_file_links" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_report_items" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weekly_reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."weeks" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "互动者可取消自己互动" ON "public"."file_interactions" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "关联创建者可删除" ON "public"."file_reference_links" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "关联创建者可删除" ON "public"."weekly_report_file_links" FOR DELETE TO "authenticated" USING (true);



CREATE POLICY "创建者可修改豁免记录" ON "public"."project_week_exemptions" FOR UPDATE TO "authenticated" USING (("created_by" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "创建者可删除豁免记录" ON "public"."project_week_exemptions" FOR DELETE TO "authenticated" USING (("created_by" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "周报填写者可修改" ON "public"."weekly_reports" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "周报填写者可修改事项" ON "public"."weekly_report_items" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."weekly_reports"
  WHERE (("weekly_reports"."id" = "weekly_report_items"."report_id") AND ("weekly_reports"."user_id" = ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."auth_id" = "auth"."uid"())))))));



CREATE POLICY "周报填写者可删除" ON "public"."weekly_reports" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "周报填写者可删除事项" ON "public"."weekly_report_items" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."weekly_reports"
  WHERE (("weekly_reports"."id" = "weekly_report_items"."report_id") AND ("weekly_reports"."user_id" = ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."auth_id" = "auth"."uid"())))))));



CREATE POLICY "周报填写者可添加事项" ON "public"."weekly_report_items" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."weekly_reports"
  WHERE (("weekly_reports"."id" = "weekly_report_items"."report_id") AND ("weekly_reports"."user_id" = ( SELECT "users"."id"
           FROM "public"."users"
          WHERE ("users"."auth_id" = "auth"."uid"())))))));



CREATE POLICY "审批者可更新审批" ON "public"."weekly_report_approvals" FOR UPDATE TO "authenticated" USING (("approver_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())))) WITH CHECK (("approver_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "文件上传者可修改" ON "public"."files" FOR UPDATE TO "authenticated" USING (("uploader_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"())))) WITH CHECK (("uploader_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "登录用户可上传文件" ON "public"."files" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "登录用户可修改自己" ON "public"."users" FOR UPDATE TO "authenticated" USING ((("auth_id" = "auth"."uid"()) AND ("deleted_at" IS NULL)));



CREATE POLICY "登录用户可发表评论" ON "public"."file_comments" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "登录用户可填写周报" ON "public"."weekly_reports" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "登录用户可查看互动" ON "public"."file_interactions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "登录用户可查看参考关联" ON "public"."file_reference_links" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "登录用户可查看周报" ON "public"."weekly_reports" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "登录用户可查看周报事项" ON "public"."weekly_report_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "登录用户可查看周报文件关联" ON "public"."weekly_report_file_links" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "登录用户可查看周次" ON "public"."weeks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "登录用户可查看处理任务" ON "public"."file_process_tasks" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "登录用户可查看审批记录" ON "public"."weekly_report_approvals" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "登录用户可查看自己通知" ON "public"."notifications" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "登录用户可查看评论" ON "public"."file_comments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "登录用户可查看豁免记录" ON "public"."project_week_exemptions" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "登录用户可查看项目文件" ON "public"."files" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "登录用户可标记已读" ON "public"."notifications" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "登录用户可添加互动" ON "public"."file_interactions" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "登录用户可添加参考关联" ON "public"."file_reference_links" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "登录用户可添加周报文件关联" ON "public"."weekly_report_file_links" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "登录用户可添加豁免记录" ON "public"."project_week_exemptions" FOR INSERT TO "authenticated" WITH CHECK (("created_by" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "登录用户可读全部" ON "public"."contract_deliverables" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "登录用户可读全部" ON "public"."departments" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "登录用户可读全部" ON "public"."project_members" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "登录用户可读全部" ON "public"."projects" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "登录用户可读全部" ON "public"."users" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "评论者可删除自己评论" ON "public"."file_comments" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



CREATE POLICY "项目经理可审批" ON "public"."weekly_report_approvals" FOR INSERT TO "authenticated" WITH CHECK (("approver_id" = ( SELECT "users"."id"
   FROM "public"."users"
  WHERE ("users"."auth_id" = "auth"."uid"()))));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_file_processor_task"() TO "postgres";
GRANT ALL ON FUNCTION "public"."enqueue_file_processor_task"() TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_file_processor_task"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_file_processor_task"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_preview_task"() TO "postgres";
GRANT ALL ON FUNCTION "public"."enqueue_preview_task"() TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_preview_task"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_preview_task"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "postgres";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."contract_deliverables" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."contract_deliverables" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."contract_deliverables" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."contract_deliverables" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."departments" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."departments" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."departments" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."departments" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_comments" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_comments" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_comments" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_comments" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_download_record" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_download_record" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_download_record" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_download_record" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_interactions" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_interactions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_interactions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_interactions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_process_tasks" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_process_tasks" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_process_tasks" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_process_tasks" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_reference_links" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_reference_links" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_reference_links" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."file_reference_links" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."files" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."files" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."files" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."files" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."notifications" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."notifications" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."notifications" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."notifications" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."project_members" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."project_members" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."project_members" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."project_members" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."project_week_exemptions" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."project_week_exemptions" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."project_week_exemptions" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."project_week_exemptions" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."projects" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."projects" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."projects" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."projects" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."users" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."users" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."users" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."users" TO "service_role";



GRANT UPDATE("avatar_url") ON TABLE "public"."users" TO "authenticated";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."weekly_report_approvals" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."weekly_report_approvals" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."weekly_report_approvals" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."weekly_report_approvals" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."weekly_report_file_links" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."weekly_report_file_links" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."weekly_report_file_links" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."weekly_report_file_links" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."weekly_report_items" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."weekly_report_items" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."weekly_report_items" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."weekly_report_items" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."weekly_reports" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."weekly_reports" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."weekly_reports" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."weekly_reports" TO "service_role";



GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."weeks" TO "postgres";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."weeks" TO "anon";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."weeks" TO "authenticated";
GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLE "public"."weeks" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT SELECT,INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,UPDATE ON TABLES TO "service_role";







