// API Response Wrapper
export interface ApiResponse<T> {
  data: T;
  cached?: boolean;
  cachedAt?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ApiError {
  error: string;
  code?: string;
  status?: number;
}
