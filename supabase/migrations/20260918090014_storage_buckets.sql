-- Buckets de Storage. Los 4 son privados (URLs firmadas de 5 minutos, ver
-- docs/arquitectura.md, sección 7): `imports`, `prefacturas`, `archivo` y
-- `brand`. Los assets de marca de uso puramente estático en la UI (favicon,
-- logo del login) viven además en `public/brand/` de Next.js, que Next sirve
-- directo sin pasar por Storage/RLS; el bucket `brand` es para que el
-- servidor (generador de PDF, plantillas de correo) recupere esos mismos
-- assets sin depender del build del frontend.

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('imports', 'imports', false, 52428800),      -- 50 MB (cubre el .xlsb de ~39 MB)
  ('prefacturas', 'prefacturas', false, 10485760), -- 10 MB por PDF
  ('archivo', 'archivo', false, 104857600),      -- 100 MB por export de período
  ('brand', 'brand', false, 10485760)
on conflict (id) do nothing;

-- imports: solo ADMIN/OPERADOR_TRANSPORTE suben y leen (contienen datos
-- operativos crudos del corte).
create policy imports_operador_todo on storage.objects for all
  using (bucket_id = 'imports' and public.rol_actual() in ('ADMIN', 'OPERADOR_TRANSPORTE'))
  with check (bucket_id = 'imports' and public.rol_actual() in ('ADMIN', 'OPERADOR_TRANSPORTE'));

-- prefacturas: cualquier rol autenticado puede leer/descargar (incluye
-- CONSULTA); solo ADMIN/OPERADOR_TRANSPORTE generan o reemplazan versiones.
create policy prefacturas_lectura on storage.objects for select
  using (bucket_id = 'prefacturas' and public.rol_actual() is not null);
create policy prefacturas_operador_escribe on storage.objects for insert
  with check (bucket_id = 'prefacturas' and public.rol_actual() in ('ADMIN', 'OPERADOR_TRANSPORTE'));
create policy prefacturas_operador_actualiza on storage.objects for update
  using (bucket_id = 'prefacturas' and public.rol_actual() in ('ADMIN', 'OPERADOR_TRANSPORTE'));
create policy prefacturas_admin_borra on storage.objects for delete
  using (bucket_id = 'prefacturas' and public.rol_actual() = 'ADMIN');

-- archivo: lectura para cualquier rol autenticado (consulta de períodos
-- archivados); solo ADMIN archiva/restaura.
create policy archivo_lectura on storage.objects for select
  using (bucket_id = 'archivo' and public.rol_actual() is not null);
create policy archivo_admin_escribe on storage.objects for all
  using (bucket_id = 'archivo' and public.rol_actual() = 'ADMIN')
  with check (bucket_id = 'archivo' and public.rol_actual() = 'ADMIN');

-- brand: lectura para cualquier rol autenticado; solo ADMIN administra los
-- assets desde Configuración.
create policy brand_lectura on storage.objects for select
  using (bucket_id = 'brand' and public.rol_actual() is not null);
create policy brand_admin_escribe on storage.objects for all
  using (bucket_id = 'brand' and public.rol_actual() = 'ADMIN')
  with check (bucket_id = 'brand' and public.rol_actual() = 'ADMIN');
