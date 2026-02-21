-- ============================================================
-- CineBuddy — Habilita RLS em drive_connection e job_id_sequence
-- Corrige avisos críticos: RLS Disabled, Sensitive Columns Exposed
-- ============================================================

ALTER TABLE public.drive_connection ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.job_id_sequence ENABLE ROW LEVEL SECURITY;
