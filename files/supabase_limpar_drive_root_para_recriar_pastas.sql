-- Limpa drive_root_folder_id dos 3 projetos para que, ao salvar no app,
-- o CineBuddy crie pastas novas no Drive com o nome correto (#BZ0001, #BZ0002, #BZ0003).
-- Execute no SQL Editor do Supabase depois de apagar as pastas antigas no Drive.

UPDATE projects SET drive_root_folder_id = NULL WHERE job_id = 'BZ0001';
UPDATE projects SET drive_root_folder_id = NULL WHERE job_id = 'BZ0002';
UPDATE projects SET drive_root_folder_id = NULL WHERE job_id = 'BZ0003';
