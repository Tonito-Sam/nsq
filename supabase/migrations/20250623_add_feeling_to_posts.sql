-- Migration: Add 'feeling' and 'location' columns to posts table
ALTER TABLE posts ADD COLUMN feeling text;
ALTER TABLE posts ADD COLUMN location text;
