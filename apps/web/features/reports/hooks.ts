import { useMutation } from '@tanstack/react-query';
import * as api from './api';

export function useCreateReport() {
  return useMutation({ mutationFn: api.createReport });
}
