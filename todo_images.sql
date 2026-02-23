create extension if not exists pgcrypto;

create table if not exists public.todo_images (
    id uuid primary key default gen_random_uuid(),
    todo_id uuid not null references public.todos(id) on delete cascade,
    user_id uuid not null,
    image_url text not null,
    sort_order integer default 0,
    created_at timestamptz default now()
);

create index if not exists idx_todo_images_todo_id on public.todo_images(todo_id);
create index if not exists idx_todo_images_user_id on public.todo_images(user_id);
create index if not exists idx_todo_images_todo_sort on public.todo_images(todo_id, sort_order);

alter table public.todo_images enable row level security;

create policy if not exists "Users can view own todo images"
    on public.todo_images for select
    using (user_id = auth.uid());

create policy if not exists "Users can insert own todo images"
    on public.todo_images for insert
    with check (user_id = auth.uid());

create policy if not exists "Users can update own todo images"
    on public.todo_images for update
    using (user_id = auth.uid())
    with check (user_id = auth.uid());

create policy if not exists "Users can delete own todo images"
    on public.todo_images for delete
    using (user_id = auth.uid());
