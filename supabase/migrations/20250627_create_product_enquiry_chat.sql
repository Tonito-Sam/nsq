-- Product Enquiry Conversations Table
create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references users(id) on delete cascade,
  seller_id uuid references users(id) on delete cascade,
  product_id uuid references store_products(id) on delete cascade,
  created_at timestamptz default now(),
  last_message_at timestamptz default now()
);

-- Product Enquiry Messages Table
create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid references conversations(id) on delete cascade,
  sender_id uuid references users(id) on delete cascade,
  content text not null,
  created_at timestamptz default now(),
  read_at timestamptz
);

-- Index for fast lookup
create index if not exists idx_conversations_seller on conversations(seller_id);
create index if not exists idx_conversations_customer on conversations(customer_id);
create index if not exists idx_messages_conversation on messages(conversation_id);
