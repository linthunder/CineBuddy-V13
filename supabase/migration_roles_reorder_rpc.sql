-- Função para atualizar a ordem de várias funções em uma única chamada (evita N round-trips)
CREATE OR REPLACE FUNCTION roles_rates_reorder(ordered_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  i int;
BEGIN
  FOR i IN 1..array_length(ordered_ids, 1) LOOP
    UPDATE roles_rates SET ordem = i - 1 WHERE id = ordered_ids[i];
  END LOOP;
END;
$$;
