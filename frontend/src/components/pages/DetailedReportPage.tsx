import { Box, Card, CardContent, Typography, useTheme } from '@mui/material';
import { useParams } from 'react-router-dom';
import { PieChart, Pie, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const reportTypeConfig: Record<string, { title: string; data: any }> = {
  performance: {
    title: '실적 상세 리포트',
    data: [
      { category: '학술 활동', value: 45, color: '#3b82f6' },
      { category: '연구 지원', value: 30, color: '#8b5cf6' },
      { category: '기술 개발', value: 25, color: '#10b981' },
    ],
  },
  papers: {
    title: '논문 상세 리포트',
    data: [
      { month: '1월', papers: 8, citations: 12 },
      { month: '2월', papers: 10, citations: 15 },
      { month: '3월', papers: 12, citations: 18 },
      { month: '4월', papers: 15, citations: 20 },
      { month: '5월', papers: 18, citations: 24 },
      { month: '6월', papers: 20, citations: 28 },
    ],
  },
  students: {
    title: '학생 상세 리포트',
    data: [
      { grade: '1학년', count: 450, percentage: 30 },
      { grade: '2학년', count: 420, percentage: 28 },
      { grade: '3학년', count: 380, percentage: 25 },
      { grade: '4학년', count: 290, percentage: 17 },
    ],
  },
  budget: {
    title: '예산 상세 리포트',
    data: [
      { category: '연구비', amount: 250000, percentage: 35 },
      { category: '교육비', amount: 200000, percentage: 28 },
      { category: '운영비', amount: 180000, percentage: 25 },
      { category: '기타', amount: 105000, percentage: 12 },
    ],
  },
};

export const DetailedReportPage = () => {
  const { reportType = 'performance' } = useParams<{ reportType: string }>();
  const theme = useTheme();
  const config = reportTypeConfig[reportType] || reportTypeConfig.performance;

  const renderChart = () => {
    switch (reportType) {
      case 'performance':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={config.data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ category, percentage }: any) => `${category} (${Math.round(percentage as number)}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {config.data.map((_entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={_entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );
      case 'papers':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={config.data}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis dataKey="month" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="papers" fill={theme.palette.primary.main} name="게재 논문" />
              <Bar dataKey="citations" fill={theme.palette.secondary.main} name="인용수" />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'students':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={config.data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
              <XAxis type="number" />
              <YAxis dataKey="grade" type="category" />
              <Tooltip />
              <Bar dataKey="count" fill={theme.palette.success.main} name="학생 수" />
            </BarChart>
          </ResponsiveContainer>
        );
      case 'budget':
        return (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={config.data}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ category, percentage }: any) => `${category} (${percentage}%)`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="amount"
              >
                {config.data.map((_entry: any, index: number) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={
                      [
                        theme.palette.primary.main,
                        theme.palette.secondary.main,
                        theme.palette.success.main,
                        theme.palette.warning.main,
                      ][index]
                    }
                  />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        );
      default:
        return null;
    }
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 700,
            mb: 1,
          }}
        >
          {config.title}
        </Typography>
        <Typography variant="body1" color="textSecondary">
          상세한 데이터 분석 및 시각화를 확인하세요
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {/* Main Chart */}
        <Card
          sx={{
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
              데이터 시각화
            </Typography>
            {renderChart()}
          </CardContent>
        </Card>

        {/* Statistics Cards */}
        <Card
          sx={{
            borderRadius: 2,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 3 }}>
              상세 통계
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 2 }}>
              {config.data.map((item: any, index: number) => (
                <Box key={index}>
                    <Box
                      sx={{
                        p: 2,
                        borderRadius: 1.5,
                        bgcolor: theme.palette.action.hover,
                        border: `1px solid ${theme.palette.divider}`,
                      }}
                    >
                      <Typography variant="body2" color="textSecondary" sx={{ mb: 0.5 }}>
                        {item.category || item.grade || item.month}
                      </Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>
                        {item.value || item.count || item.papers || item.amount
                          ? (item.value || item.count || item.papers || item.amount).toLocaleString()
                          : 'N/A'}
                      </Typography>
                      {item.percentage && (
                        <Typography variant="caption" color="textSecondary">
                          ({item.percentage}%)
                        </Typography>
                      )}
                    </Box>
                  </Box>
              ))}
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};
