import type { RowDataPacket } from 'mysql2';

export type BookStatus = 'active' | 'inactive';
export type Availability = 'all' | 'available' | 'unavailable';

export interface BookRow extends RowDataPacket {
  id: number;
  isbn: string;
  title: string;
  author: string;
  publisher: string | null;
  publish_year: number | null;
  category_id: number | null;
  description: string | null;
  shelf_location: string | null;
  total_copies: number;
  available_copies: number;
  cover_path: string | null;
  status: BookStatus;
  created_at: string;
  updated_at: string;
  category_name?: string | null;
  active_loans?: number;
}

export interface Book {
  id: number;
  isbn: string;
  title: string;
  author: string;
  publisher: string | null;
  publishYear: number | null;
  categoryId: number | null;
  categoryName: string | null;
  description: string | null;
  shelfLocation: string | null;
  totalCopies: number;
  availableCopies: number;
  borrowedCopies: number;
  coverPath: string | null;
  status: BookStatus;
  createdAt: string;
  updatedAt: string;
}

export function toBook(row: BookRow): Book {
  return {
    id: row.id,
    isbn: row.isbn,
    title: row.title,
    author: row.author,
    publisher: row.publisher,
    publishYear: row.publish_year,
    categoryId: row.category_id,
    categoryName: row.category_name ?? null,
    description: row.description,
    shelfLocation: row.shelf_location,
    totalCopies: row.total_copies,
    availableCopies: row.available_copies,
    borrowedCopies: Math.max(0, row.total_copies - row.available_copies),
    coverPath: row.cover_path,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
