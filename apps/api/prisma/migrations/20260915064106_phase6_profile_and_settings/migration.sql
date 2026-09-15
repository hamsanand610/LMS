-- CreateTable
CREATE TABLE "resumes" (
    "id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "file_id" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL DEFAULT '',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_pages" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "updated_by_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "content_pages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_templates" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "key" VARCHAR(64) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "body_html" TEXT NOT NULL DEFAULT '',
    "body_text" TEXT NOT NULL DEFAULT '',
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "email_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "integration_configs" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "driver" VARCHAR(40) NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "secret" TEXT NOT NULL DEFAULT '',
    "updated_by_id" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "integration_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "resumes_student_id_uploaded_at_idx" ON "resumes"("student_id", "uploaded_at");

-- CreateIndex
CREATE UNIQUE INDEX "content_pages_organization_id_slug_key" ON "content_pages"("organization_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "email_templates_organization_id_key_key" ON "email_templates"("organization_id", "key");

-- CreateIndex
CREATE UNIQUE INDEX "integration_configs_organization_id_provider_key" ON "integration_configs"("organization_id", "provider");

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "student_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_pages" ADD CONSTRAINT "content_pages_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_templates" ADD CONSTRAINT "email_templates_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "integration_configs" ADD CONSTRAINT "integration_configs_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
