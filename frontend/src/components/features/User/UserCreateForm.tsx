import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreateUser } from '@/hooks/queries/useUsers';
import { Box, TextField, Button, Select, MenuItem, FormControl, InputLabel, Alert } from '@mui/material';
import type { CreateUserRequest } from '@/types/dto/users.dto';

const createUserSchema = z.object({
  username: z.string().min(3, '아이디는 3자 이상이어야 합니다'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다'),
  full_name: z.string().min(1, '이름을 입력해주세요'),
  role: z.enum(['admin', 'user']),
});

type CreateUserFormData = z.infer<typeof createUserSchema>;

export const UserCreateForm = () => {
  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateUserFormData>({
    resolver: zodResolver(createUserSchema),
  });
  const { mutate: createUser, isPending, isError, error } = useCreateUser();

  const onSubmit = (data: CreateUserFormData) => {
    createUser(data as CreateUserRequest, {
      onSuccess: () => {
        reset();
      },
    });
  };

  return (
    <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ maxWidth: 500, mx: 'auto' }}>
      <h2>사용자 생성</h2>

      {isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error?.message || '사용자 생성 중 오류가 발생했습니다'}
        </Alert>
      )}

      <TextField
        fullWidth
        label="아이디"
        {...register('username')}
        error={!!errors.username}
        helperText={errors.username?.message}
        margin="normal"
      />

      <TextField
        fullWidth
        label="비밀번호"
        type="password"
        {...register('password')}
        error={!!errors.password}
        helperText={errors.password?.message}
        margin="normal"
      />

      <TextField
        fullWidth
        label="이름"
        {...register('full_name')}
        error={!!errors.full_name}
        helperText={errors.full_name?.message}
        margin="normal"
      />

      <FormControl fullWidth margin="normal">
        <InputLabel>역할</InputLabel>
        <Select {...register('role')} label="역할" defaultValue="user">
          <MenuItem value="user">사용자</MenuItem>
          <MenuItem value="admin">관리자</MenuItem>
        </Select>
      </FormControl>

      <Button
        type="submit"
        variant="contained"
        fullWidth
        disabled={isPending}
        sx={{ mt: 3 }}
      >
        {isPending ? '생성 중...' : '사용자 생성'}
      </Button>
    </Box>
  );
};
