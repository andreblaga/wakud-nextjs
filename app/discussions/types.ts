export type ChannelRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string | null;
};

export type MessageRow = {
  id: string;
  channel_id: string;
  parent_id: string | null;
  user_id: string | null;
  author_email: string | null;
  body: string;
  created_at: string | null;
};
