import { useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  useTheme,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  Article as ArticleIcon,
  AttachMoney as AttachMoneyIcon,
  EventNote as EventNoteIcon,
} from '@mui/icons-material';
import { useCurrentUser } from '@/hooks/queries/useAuth';
import {
  useDashboardSummary,
  useResearchData,
  useKPIData,
  usePublicationsData,
} from '@/hooks/queries/useDashboard';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { DetailModal } from '@/components/features/Dashboard/DetailModal';

interface MetricCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  color: string;
  trend?: number;
  onClick?: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  icon,
  color,
  trend,
  onClick,
}) => {
  const theme = useTheme();

  return (
    <Card
      onClick={onClick}
      sx={{
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        transition: 'all 0.3s ease',
        cursor: onClick ? 'pointer' : 'default',
        '&:hover': {
          transform: onClick ? 'translateY(-2px)' : 'none',
          boxShadow: onClick ? `0 8px 16px ${color}15` : 'none',
        },
        height: '100%',
      }}
    >
      <CardContent sx={{ p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 48,
              height: 48,
              borderRadius: 1.5,
              bgcolor: `${color}15`,
              color: color,
            }}
          >
            {icon}
          </Box>
          {trend !== undefined && (
            <Chip
              size="small"
              label={`+${trend}%`}
              variant="outlined"
              sx={{
                height: 24,
                fontSize: '0.75rem',
                color: 'success.main',
                borderColor: 'success.main',
              }}
            />
          )}
        </Box>
        <Typography variant="body2" color="textSecondary" sx={{ mb: 1, fontSize: '0.875rem' }}>
          {title}
        </Typography>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            color: theme.palette.text.primary,
          }}
        >
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
};

export const DashboardPage = () => {
  const theme = useTheme();
  const { data: currentUser } = useCurrentUser();
  
  // Modal state
  const [detailModal, setDetailModal] = useState<{
    open: boolean;
    title: string;
    data: any[];
    columns: { key: string; label: string; format?: (value: any, row: any) => string }[];
  }>({
    open: false,
    title: '',
    data: [],
    columns: [],
  });
  
  // React Query hooks
  const { data: summaryData, isLoading: isLoadingSummary, error: summaryError } = useDashboardSummary({});
  const { data: researchData, isLoading: isLoadingResearch } = useResearchData({});
  const { data: kpiData, isLoading: isLoadingKPI } = useKPIData({});
  const { data: publicationsData, isLoading: isLoadingPublications } = usePublicationsData({});

  const metrics = [
    {
      title: '게재 논문 수',
      value: isLoadingSummary ? '-' : (summaryData?.summary?.total_publications || 0).toString(),
      icon: <ArticleIcon sx={{ fontSize: 28 }} />,
      color: theme.palette.success.main,
      trend: undefined,
      onClick: () => {
        if (isLoadingPublications) return;
        if (publicationsData && publicationsData.data.length > 0) {
          setDetailModal({
            open: true,
            title: '전체 게재 논문 목록',
            data: publicationsData.data,
            columns: [
              { key: '논문ID', label: 'ID' },
              { key: '게재일', label: '게재일' },
              { key: '학과', label: '학과' },
              { key: '논문제목', label: '논문제목' },
              { key: '주저자', label: '주저자' },
              { key: '참여저자', label: '참여저자' },
              { key: '학술지명', label: '학술지명' },
              { key: '저널등급', label: '등급' },
              { key: 'Impact Factor', label: 'IF' },
              { key: '과제연계여부', label: '과제연계' },
            ],
          });
        }
      },
    },
    {
      title: '연구 프로젝트',
      value: isLoadingSummary ? '-' : (summaryData?.summary?.total_research_projects || 0).toString(),
      icon: <TrendingUpIcon sx={{ fontSize: 28 }} />,
      color: theme.palette.secondary.main,
      trend: undefined,
      onClick: () => {
        if (researchData && researchData.data.length > 0) {
          // Get unique projects by 과제번호
          const uniqueProjects = Array.from(
            new Map(
              researchData.data.map((item: any) => [item.과제번호, item])
            ).values()
          );
          setDetailModal({
            open: true,
            title: '전체 연구 프로젝트 목록',
            data: uniqueProjects,
            columns: [
              { key: '과제번호', label: '과제번호' },
              { key: '과제명', label: '과제명' },
              { key: '연구책임자', label: '연구책임자' },
              { key: '소속학과', label: '학과' },
              { key: '지원기관', label: '지원기관' },
              { 
                key: '총연구비', 
                label: '총연구비', 
                format: (val) => val ? `${(val / 100000000).toFixed(1)}억원` : '-'
              },
            ],
          });
        }
      },
    },
    {
      title: '총 연구비 (억원)',
      value: isLoadingSummary ? '-' : `${((summaryData?.summary?.total_research_budget || 0) / 100000000).toFixed(1)}`,
      icon: <AttachMoneyIcon sx={{ fontSize: 28 }} />,
      color: theme.palette.warning.main,
      trend: undefined,
    },
  ];

  return (
    <Box>
      {summaryError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          데이터를 불러오는 중 오류가 발생했습니다: {summaryError.message}
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 700,
            mb: 1,
          }}
        >
          대시보드
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', mt: 1 }}>
          <Chip
            icon={<EventNoteIcon />}
            label={
              summaryData?.year === 'all' || !summaryData?.year
                ? '전체 데이터'
                : `${summaryData.year}년 ${summaryData.semester !== 'all' ? summaryData.semester : ''}`
            }
            variant="outlined"
            size="medium"
          />
          <Typography variant="body1" color="textSecondary">
            {currentUser?.username && (
              <span>
                환영합니다, <strong>{currentUser.username}</strong>님
              </span>
            )}
          </Typography>
        </Box>
      </Box>

      {/* Metric Cards */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(4, 1fr)',
          },
          gap: 2,
          mb: 3,
        }}
      >
        {metrics.map((metric, index) => (
          <MetricCard key={index} {...metric} />
        ))}
      </Box>

      {/* Charts Section */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* 2x2 Grid Charts */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 2 }}>
          {/* Research Budget by Department - Bar Chart */}
          <Card
            sx={{
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                학과별 총 연구비
              </Typography>
              {isLoadingResearch ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
                  <CircularProgress />
                </Box>
              ) : researchData && researchData.data.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart 
                    data={
                      Object.values(
                        researchData.data.reduce((acc: any, item: any) => {
                          const dept = item.소속학과 || item.department || '기타';
                          const budget = item.총연구비 || 0;
                          if (!acc[dept]) {
                            acc[dept] = { department: dept, budget: 0 };
                          }
                          acc[dept].budget += budget / 100000000;
                          return acc;
                        }, {})
                      ).map((item: any) => ({
                        ...item,
                        budget: Number(item.budget.toFixed(1))
                      }))
                    }
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    onClick={(data: any) => {
                      if (data && data.activePayload && data.activePayload[0]) {
                        const clickedDept = data.activePayload[0].payload.department;
                        const deptResearch = researchData.data.filter(
                          (item: any) => (item.소속학과 || item.department || '기타') === clickedDept
                        );
                        setDetailModal({
                          open: true,
                          title: `${clickedDept} - 연구 프로젝트`,
                          data: deptResearch,
                          columns: [
                            { key: '과제번호', label: '과제번호' },
                            { key: '과제명', label: '과제명' },
                            { key: '연구책임자', label: '연구책임자' },
                            { key: '지원기관', label: '지원기관' },
                            { 
                              key: '총연구비', 
                              label: '총연구비', 
                              format: (val) => val ? `${(val / 100000000).toFixed(1)}억원` : '-'
                            },
                            { key: '집행일자', label: '집행일자' },
                            { key: '집행항목', label: '집행항목' },
                            { 
                              key: '집행금액', 
                              label: '집행금액', 
                              format: (val) => val ? `${(val / 100000000).toFixed(2)}억원` : '-'
                            },
                            { key: '상태', label: '상태' },
                            { key: '비고', label: '비고' },
                          ],
                        });
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis dataKey="department" style={{ fontSize: '0.75rem' }} />
                    <YAxis style={{ fontSize: '0.75rem' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 8,
                        fontSize: '0.875rem',
                      }}
                      formatter={(value: number) => [`${value}억원`, '총 연구비']}
                    />
                    <Bar 
                      dataKey="budget" 
                      fill={theme.palette.warning.main} 
                      name="연구비 (억원)"
                      cursor="pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Typography color="textSecondary" sx={{ textAlign: 'center', py: 10 }}>
                  데이터가 없습니다
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* College Employment Rate - Bar Chart */}
          <Card
            sx={{
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                단과대학별 평균 취업률
              </Typography>
              {isLoadingKPI ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
                  <CircularProgress />
                </Box>
              ) : kpiData && kpiData.data.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart 
                    data={
                      Object.values(
                        kpiData.data.reduce((acc: any, item: any) => {
                          const college = item.college || '기타';
                          const rate = item['졸업생 취업률 (%)'] || 0;
                          if (!acc[college]) {
                            acc[college] = { college, total: 0, count: 0 };
                          }
                          acc[college].total += rate;
                          acc[college].count += 1;
                          return acc;
                        }, {})
                      ).map((item: any) => ({
                        college: item.college,
                        rate: Number((item.total / item.count).toFixed(1))
                      }))
                    }
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    onClick={(data: any) => {
                      if (data && data.activePayload && data.activePayload[0]) {
                        const clickedCollege = data.activePayload[0].payload.college;
                        const collegeKPI = kpiData.data.filter(
                          (item: any) => (item.college || '기타') === clickedCollege
                        );
                        setDetailModal({
                          open: true,
                          title: `${clickedCollege} - 학과별 KPI`,
                          data: collegeKPI,
                          columns: [
                            { key: 'year', label: '평가년도' },
                            { key: 'department', label: '학과' },
                            { 
                              key: '졸업생 취업률 (%)', 
                              label: '취업률', 
                              format: (val) => val ? `${val}%` : '-'
                            },
                            { key: '전임교원 수 (명)', label: '전임교원' },
                            { key: '초빙교원 수 (명)', label: '초빙교원' },
                            { 
                              key: '연간 기술이전 수입액 (억원)', 
                              label: '기술이전 수입', 
                              format: (val) => val ? `${val}억원` : '-'
                            },
                            { key: '국제학술대회 개최 횟수', label: '국제학회' },
                          ],
                        });
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis dataKey="college" style={{ fontSize: '0.75rem' }} />
                    <YAxis style={{ fontSize: '0.75rem' }} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 8,
                        fontSize: '0.875rem',
                      }}
                      formatter={(value: number) => [`${value}%`, '평균 취업률']}
                    />
                    <Bar 
                      dataKey="rate" 
                      fill={theme.palette.success.main} 
                      name="취업률 (%)"
                      cursor="pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Typography color="textSecondary" sx={{ textAlign: 'center', py: 10 }}>
                  데이터가 없습니다
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Faculty Count by College - Bar Chart */}
          <Card
            sx={{
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                단과대학별 교원 현황
              </Typography>
              {isLoadingKPI ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
                  <CircularProgress />
                </Box>
              ) : kpiData && kpiData.data.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart 
                    data={
                      Object.values(
                        kpiData.data.reduce((acc: any, item: any) => {
                          const college = item.college || '기타';
                          const tenured = Number(item['전임교원 수 (명)']) || 0;
                          const visiting = Number(item['초빙교원 수 (명)']) || 0;
                          if (!acc[college]) {
                            acc[college] = { college, tenured: 0, visiting: 0 };
                          }
                          acc[college].tenured += tenured;
                          acc[college].visiting += visiting;
                          return acc;
                        }, {})
                      )
                    }
                    margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    onClick={(data: any) => {
                      if (data && data.activePayload && data.activePayload[0]) {
                        const clickedCollege = data.activePayload[0].payload.college;
                        const collegeFaculty = kpiData.data.filter(
                          (item: any) => (item.college || '기타') === clickedCollege
                        );
                        setDetailModal({
                          open: true,
                          title: `${clickedCollege} - 학과별 상세 현황`,
                          data: collegeFaculty,
                          columns: [
                            { key: 'year', label: '평가년도' },
                            { key: 'department', label: '학과' },
                            { 
                              key: '졸업생 취업률 (%)', 
                              label: '취업률', 
                              format: (val) => val ? `${val}%` : '-'
                            },
                            { key: '전임교원 수 (명)', label: '전임교원' },
                            { key: '초빙교원 수 (명)', label: '초빙교원' },
                            { 
                              key: 'total', 
                              label: '총 교원', 
                              format: (_val, row) => {
                                const tenured = Number(row['전임교원 수 (명)']) || 0;
                                const visiting = Number(row['초빙교원 수 (명)']) || 0;
                                return `${tenured + visiting}명`;
                              }
                            },
                            { 
                              key: '연간 기술이전 수입액 (억원)', 
                              label: '기술이전', 
                              format: (val) => val ? `${val}억원` : '-'
                            },
                            { key: '국제학술대회 개최 횟수', label: '국제학회' },
                          ],
                        });
                      }
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.palette.divider} />
                    <XAxis dataKey="college" style={{ fontSize: '0.75rem' }} />
                    <YAxis style={{ fontSize: '0.75rem' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 8,
                        fontSize: '0.875rem',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '0.75rem' }} />
                    <Bar 
                      dataKey="tenured" 
                      fill={theme.palette.secondary.main} 
                      name="전임교원" 
                      stackId="a"
                      cursor="pointer"
                    />
                    <Bar 
                      dataKey="visiting" 
                      fill={theme.palette.info.main} 
                      name="초빙교원" 
                      stackId="a"
                      cursor="pointer"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <Typography color="textSecondary" sx={{ textAlign: 'center', py: 10 }}>
                  데이터가 없습니다
                </Typography>
              )}
            </CardContent>
          </Card>
        </Box>
      </Box>

      {/* Detail Modal */}
      <DetailModal
        open={detailModal.open}
        onClose={() => setDetailModal({ ...detailModal, open: false })}
        title={detailModal.title}
        data={detailModal.data}
        columns={detailModal.columns}
      />
    </Box>
  );
};
