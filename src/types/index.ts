export interface Category {
  id: number
  name: string
  slug: string
}

export interface Note {
  id: string
  title: string
  description: string | null
  semester: number | null
  unit: string | null
  tags: string[]
  download_count: number
  created_at: string
  categories: { name: string; slug: string } | null
  note_files: { file_type: string }[]
}