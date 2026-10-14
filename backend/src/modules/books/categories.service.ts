import { execute, query, queryOne, type RowDataPacket } from '../../config/db';
import { conflict, notFound } from '../../lib/errors';
import type { CategoryInput } from '../books/books.schema';

interface CategoryRow extends RowDataPacket {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  book_count: number;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  bookCount: number;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export async function listCategories(): Promise<Category[]> {
  const rows = await query<CategoryRow>(
    `SELECT c.id, c.name, c.slug, c.description, COUNT(b.id) AS book_count
       FROM categories c
       LEFT JOIN books b ON b.category_id = c.id
      GROUP BY c.id, c.name, c.slug, c.description
      ORDER BY c.name ASC`,
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description,
    bookCount: Number(r.book_count),
  }));
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  const slug = slugify(input.name);
  const existing = await queryOne<RowDataPacket & { id: number }>(
    'SELECT id FROM categories WHERE name = ? OR slug = ? LIMIT 1',
    [input.name, slug],
  );
  if (existing) throw conflict('Kategori dengan nama tersebut sudah ada.');

  const result = await execute(
    'INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)',
    [input.name, slug, input.description || null],
  );
  return getCategory(result.insertId);
}

export async function getCategory(id: number): Promise<Category> {
  const row = await queryOne<CategoryRow>(
    `SELECT c.id, c.name, c.slug, c.description, COUNT(b.id) AS book_count
       FROM categories c
       LEFT JOIN books b ON b.category_id = c.id
      WHERE c.id = ?
      GROUP BY c.id, c.name, c.slug, c.description`,
    [id],
  );
  if (!row) throw notFound('Kategori tidak ditemukan.');
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    bookCount: Number(row.book_count),
  };
}

export async function updateCategory(
  id: number,
  input: Partial<CategoryInput>,
): Promise<Category> {
  const current = await getCategory(id);

  if (input.name && input.name !== current.name) {
    const clash = await queryOne<RowDataPacket & { id: number }>(
      'SELECT id FROM categories WHERE (name = ? OR slug = ?) AND id <> ? LIMIT 1',
      [input.name, slugify(input.name), id],
    );
    if (clash) throw conflict('Kategori dengan nama tersebut sudah ada.');
  }

  const name = input.name ?? current.name;
  await execute('UPDATE categories SET name = ?, slug = ?, description = ? WHERE id = ?', [
    name,
    slugify(name),
    input.description === undefined ? current.description : input.description || null,
    id,
  ]);
  return getCategory(id);
}

export async function deleteCategory(id: number): Promise<void> {
  const current = await getCategory(id);
  if (current.bookCount > 0) {
    throw conflict(
      `Kategori "${current.name}" masih memiliki ${current.bookCount} buku. Pindahkan buku terlebih dahulu.`,
    );
  }
  await execute('DELETE FROM categories WHERE id = ?', [id]);
}
