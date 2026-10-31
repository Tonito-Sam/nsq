INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('digital-products', 'digital-products', false, 104857600)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 104857600;

DROP POLICY IF EXISTS digital_product_files_insert_own ON storage.objects;
CREATE POLICY digital_product_files_insert_own
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'digital-products'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS digital_product_files_read_own ON storage.objects;
CREATE POLICY digital_product_files_read_own
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'digital-products'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS digital_product_files_delete_own ON storage.objects;
CREATE POLICY digital_product_files_delete_own
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'digital-products'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );