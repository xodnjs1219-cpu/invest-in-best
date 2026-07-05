import { createBrowserRouter } from 'react-router-dom';
import { routes } from '@/router/routes';

export const router = (props: { toggleTheme: () => void; isDarkMode: boolean }) =>
  createBrowserRouter(routes(props));
