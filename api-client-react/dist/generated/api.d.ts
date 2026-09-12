import type { QueryKey, UseMutationOptions, UseMutationResult, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import type { AiProviderStatus, Analysis, AnalysisInput, BenchmarkRegression, BenchmarkReport, BenchmarkSample, BenchmarkThresholds, CheckBenchmarkRegressionParams, DashboardSummary, ErrorEnvelope, GetBenchmarkReportParams, HealthStatus, ManualVerdictInput, UploadUrlRequest, UploadUrlResponse, VideoEditProject } from './api.schemas';
import { customFetch } from '../custom-fetch';
import type { ErrorType, BodyType } from '../custom-fetch';
type AwaitedInput<T> = PromiseLike<T> | T;
type Awaited<O> = O extends AwaitedInput<infer T> ? T : never;
type SecondParameter<T extends (...args: never) => unknown> = Parameters<T>[1];
export declare const getHealthCheckUrl: () => string;
/**
 * Returns server health status
 * @summary Health check
 */
export declare const healthCheck: (options?: Parameters<typeof customFetch>[1]) => Promise<HealthStatus>;
export declare const getHealthCheckQueryKey: () => readonly ["/api/healthz"];
export declare const getHealthCheckQueryOptions: <TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData> & {
    queryKey: QueryKey;
};
export type HealthCheckQueryResult = NonNullable<Awaited<ReturnType<typeof healthCheck>>>;
export type HealthCheckQueryError = ErrorType<unknown>;
/**
 * @summary Health check
 */
export declare function useHealthCheck<TData = Awaited<ReturnType<typeof healthCheck>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof healthCheck>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetDashboardSummaryUrl: () => string;
/**
 * @summary Get analysis dashboard summary
 */
export declare const getDashboardSummary: (options?: Parameters<typeof customFetch>[1]) => Promise<DashboardSummary>;
export declare const getGetDashboardSummaryQueryKey: () => readonly ["/api/dashboard/summary"];
export declare const getGetDashboardSummaryQueryOptions: <TData = Awaited<ReturnType<typeof getDashboardSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getDashboardSummary>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetDashboardSummaryQueryResult = NonNullable<Awaited<ReturnType<typeof getDashboardSummary>>>;
export type GetDashboardSummaryQueryError = ErrorType<unknown>;
/**
 * @summary Get analysis dashboard summary
 */
export declare function useGetDashboardSummary<TData = Awaited<ReturnType<typeof getDashboardSummary>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getDashboardSummary>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetAiProviderStatusUrl: () => string;
/**
 * @summary Get safe AI provider capability and cost estimate
 */
export declare const getAiProviderStatus: (options?: Parameters<typeof customFetch>[1]) => Promise<AiProviderStatus>;
export declare const getGetAiProviderStatusQueryKey: () => readonly ["/api/dashboard/ai-status"];
export declare const getGetAiProviderStatusQueryOptions: <TData = Awaited<ReturnType<typeof getAiProviderStatus>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAiProviderStatus>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAiProviderStatus>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAiProviderStatusQueryResult = NonNullable<Awaited<ReturnType<typeof getAiProviderStatus>>>;
export type GetAiProviderStatusQueryError = ErrorType<unknown>;
/**
 * @summary Get safe AI provider capability and cost estimate
 */
export declare function useGetAiProviderStatus<TData = Awaited<ReturnType<typeof getAiProviderStatus>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAiProviderStatus>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListBenchmarkSamplesUrl: () => string;
/**
 * @summary List the anonymized labeled benchmark set
 */
export declare const listBenchmarkSamples: (options?: Parameters<typeof customFetch>[1]) => Promise<BenchmarkSample[]>;
export declare const getListBenchmarkSamplesQueryKey: () => readonly ["/api/benchmarks/samples"];
export declare const getListBenchmarkSamplesQueryOptions: <TData = Awaited<ReturnType<typeof listBenchmarkSamples>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listBenchmarkSamples>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listBenchmarkSamples>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListBenchmarkSamplesQueryResult = NonNullable<Awaited<ReturnType<typeof listBenchmarkSamples>>>;
export type ListBenchmarkSamplesQueryError = ErrorType<unknown>;
/**
 * @summary List the anonymized labeled benchmark set
 */
export declare function useListBenchmarkSamples<TData = Awaited<ReturnType<typeof listBenchmarkSamples>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listBenchmarkSamples>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetBenchmarkReportUrl: (params: GetBenchmarkReportParams) => string;
/**
 * @summary Get confusion matrix, class recall, and AI false positives
 */
export declare const getBenchmarkReport: (params: GetBenchmarkReportParams, options?: Parameters<typeof customFetch>[1]) => Promise<BenchmarkReport>;
export declare const getGetBenchmarkReportQueryKey: (params?: GetBenchmarkReportParams) => readonly ["/api/benchmarks/report", ...GetBenchmarkReportParams[]];
export declare const getGetBenchmarkReportQueryOptions: <TData = Awaited<ReturnType<typeof getBenchmarkReport>>, TError = ErrorType<unknown>>(params: GetBenchmarkReportParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBenchmarkReport>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getBenchmarkReport>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetBenchmarkReportQueryResult = NonNullable<Awaited<ReturnType<typeof getBenchmarkReport>>>;
export type GetBenchmarkReportQueryError = ErrorType<unknown>;
/**
 * @summary Get confusion matrix, class recall, and AI false positives
 */
export declare function useGetBenchmarkReport<TData = Awaited<ReturnType<typeof getBenchmarkReport>>, TError = ErrorType<unknown>>(params: GetBenchmarkReportParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBenchmarkReport>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCheckBenchmarkRegressionUrl: (params: CheckBenchmarkRegressionParams) => string;
/**
 * @summary Check a prompt version against minimum regression thresholds
 */
export declare const checkBenchmarkRegression: (params: CheckBenchmarkRegressionParams, options?: Parameters<typeof customFetch>[1]) => Promise<BenchmarkRegression>;
export declare const getCheckBenchmarkRegressionQueryKey: (params?: CheckBenchmarkRegressionParams) => readonly ["/api/benchmarks/regression", ...CheckBenchmarkRegressionParams[]];
export declare const getCheckBenchmarkRegressionQueryOptions: <TData = Awaited<ReturnType<typeof checkBenchmarkRegression>>, TError = ErrorType<BenchmarkRegression>>(params: CheckBenchmarkRegressionParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof checkBenchmarkRegression>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof checkBenchmarkRegression>>, TError, TData> & {
    queryKey: QueryKey;
};
export type CheckBenchmarkRegressionQueryResult = NonNullable<Awaited<ReturnType<typeof checkBenchmarkRegression>>>;
export type CheckBenchmarkRegressionQueryError = ErrorType<BenchmarkRegression>;
/**
 * @summary Check a prompt version against minimum regression thresholds
 */
export declare function useCheckBenchmarkRegression<TData = Awaited<ReturnType<typeof checkBenchmarkRegression>>, TError = ErrorType<BenchmarkRegression>>(params: CheckBenchmarkRegressionParams, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof checkBenchmarkRegression>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetBenchmarkThresholdsUrl: () => string;
/**
 * @summary Get minimum prompt regression thresholds
 */
export declare const getBenchmarkThresholds: (options?: Parameters<typeof customFetch>[1]) => Promise<BenchmarkThresholds>;
export declare const getGetBenchmarkThresholdsQueryKey: () => readonly ["/api/benchmarks/thresholds"];
export declare const getGetBenchmarkThresholdsQueryOptions: <TData = Awaited<ReturnType<typeof getBenchmarkThresholds>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBenchmarkThresholds>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getBenchmarkThresholds>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetBenchmarkThresholdsQueryResult = NonNullable<Awaited<ReturnType<typeof getBenchmarkThresholds>>>;
export type GetBenchmarkThresholdsQueryError = ErrorType<unknown>;
/**
 * @summary Get minimum prompt regression thresholds
 */
export declare function useGetBenchmarkThresholds<TData = Awaited<ReturnType<typeof getBenchmarkThresholds>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getBenchmarkThresholds>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getListAnalysesUrl: () => string;
/**
 * @summary List video analyses
 */
export declare const listAnalyses: (options?: Parameters<typeof customFetch>[1]) => Promise<Analysis[]>;
export declare const getListAnalysesQueryKey: () => readonly ["/api/analyses"];
export declare const getListAnalysesQueryOptions: <TData = Awaited<ReturnType<typeof listAnalyses>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAnalyses>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof listAnalyses>>, TError, TData> & {
    queryKey: QueryKey;
};
export type ListAnalysesQueryResult = NonNullable<Awaited<ReturnType<typeof listAnalyses>>>;
export type ListAnalysesQueryError = ErrorType<unknown>;
/**
 * @summary List video analyses
 */
export declare function useListAnalyses<TData = Awaited<ReturnType<typeof listAnalyses>>, TError = ErrorType<unknown>>(options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof listAnalyses>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getCreateAnalysisUrl: () => string;
/**
 * @summary Create and start a video or image analysis
 */
export declare const createAnalysis: (analysisInput: AnalysisInput, options?: Parameters<typeof customFetch>[1]) => Promise<Analysis>;
export declare const getCreateAnalysisMutationOptions: <TError = ErrorType<ErrorEnvelope>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAnalysis>>, TError, {
        data: BodyType<AnalysisInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof createAnalysis>>, TError, {
    data: BodyType<AnalysisInput>;
}, TContext>;
export type CreateAnalysisMutationResult = NonNullable<Awaited<ReturnType<typeof createAnalysis>>>;
export type CreateAnalysisMutationBody = BodyType<AnalysisInput>;
export type CreateAnalysisMutationError = ErrorType<ErrorEnvelope>;
/**
* @summary Create and start a video or image analysis
*/
export declare const useCreateAnalysis: <TError = ErrorType<ErrorEnvelope>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof createAnalysis>>, TError, {
        data: BodyType<AnalysisInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof createAnalysis>>, TError, {
    data: BodyType<AnalysisInput>;
}, TContext>;
export declare const getGetAnalysisUrl: (id: number) => string;
/**
 * @summary Get an analysis detail
 */
export declare const getAnalysis: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<Analysis>;
export declare const getGetAnalysisQueryKey: (id: number) => readonly [`/api/analyses/${number}`];
export declare const getGetAnalysisQueryOptions: <TData = Awaited<ReturnType<typeof getAnalysis>>, TError = ErrorType<ErrorEnvelope>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAnalysis>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAnalysis>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAnalysisQueryResult = NonNullable<Awaited<ReturnType<typeof getAnalysis>>>;
export type GetAnalysisQueryError = ErrorType<ErrorEnvelope>;
/**
 * @summary Get an analysis detail
 */
export declare function useGetAnalysis<TData = Awaited<ReturnType<typeof getAnalysis>>, TError = ErrorType<ErrorEnvelope>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAnalysis>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getDeleteAnalysisUrl: (id: number) => string;
/**
 * @summary Delete an analysis
 */
export declare const deleteAnalysis: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<void>;
export declare const getDeleteAnalysisMutationOptions: <TError = ErrorType<ErrorEnvelope>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteAnalysis>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof deleteAnalysis>>, TError, {
    id: number;
}, TContext>;
export type DeleteAnalysisMutationResult = NonNullable<Awaited<ReturnType<typeof deleteAnalysis>>>;
export type DeleteAnalysisMutationError = ErrorType<ErrorEnvelope>;
/**
* @summary Delete an analysis
*/
export declare const useDeleteAnalysis: <TError = ErrorType<ErrorEnvelope>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof deleteAnalysis>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof deleteAnalysis>>, TError, {
    id: number;
}, TContext>;
export declare const getReanalyzeVideoUrl: (id: number) => string;
/**
 * @summary Queue an analysis again
 */
export declare const reanalyzeVideo: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<Analysis>;
export declare const getReanalyzeVideoMutationOptions: <TError = ErrorType<ErrorEnvelope>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof reanalyzeVideo>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof reanalyzeVideo>>, TError, {
    id: number;
}, TContext>;
export type ReanalyzeVideoMutationResult = NonNullable<Awaited<ReturnType<typeof reanalyzeVideo>>>;
export type ReanalyzeVideoMutationError = ErrorType<ErrorEnvelope>;
/**
* @summary Queue an analysis again
*/
export declare const useReanalyzeVideo: <TError = ErrorType<ErrorEnvelope>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof reanalyzeVideo>>, TError, {
        id: number;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof reanalyzeVideo>>, TError, {
    id: number;
}, TContext>;
export declare const getGetAnalysisPreviewUrl: (id: number) => string;
/**
 * @summary Stream the original media preview
 */
export declare const getAnalysisPreview: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<Blob>;
export declare const getGetAnalysisPreviewQueryKey: (id: number) => readonly [`/api/analyses/${number}/preview`];
export declare const getGetAnalysisPreviewQueryOptions: <TData = Awaited<ReturnType<typeof getAnalysisPreview>>, TError = ErrorType<ErrorEnvelope>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAnalysisPreview>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getAnalysisPreview>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetAnalysisPreviewQueryResult = NonNullable<Awaited<ReturnType<typeof getAnalysisPreview>>>;
export type GetAnalysisPreviewQueryError = ErrorType<ErrorEnvelope>;
/**
 * @summary Stream the original media preview
 */
export declare function useGetAnalysisPreview<TData = Awaited<ReturnType<typeof getAnalysisPreview>>, TError = ErrorType<ErrorEnvelope>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getAnalysisPreview>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getStreamAnalysisSourceUrl: (id: number) => string;
/**
 * @summary Stream the durable original video with byte range support
 */
export declare const streamAnalysisSource: (id: number, options?: Parameters<typeof customFetch>[1]) => Promise<Blob>;
export declare const getStreamAnalysisSourceQueryKey: (id: number) => readonly [`/api/analyses/${number}/stream`];
export declare const getStreamAnalysisSourceQueryOptions: <TData = Awaited<ReturnType<typeof streamAnalysisSource>>, TError = ErrorType<ErrorEnvelope>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof streamAnalysisSource>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof streamAnalysisSource>>, TError, TData> & {
    queryKey: QueryKey;
};
export type StreamAnalysisSourceQueryResult = NonNullable<Awaited<ReturnType<typeof streamAnalysisSource>>>;
export type StreamAnalysisSourceQueryError = ErrorType<ErrorEnvelope>;
/**
 * @summary Stream the durable original video with byte range support
 */
export declare function useStreamAnalysisSource<TData = Awaited<ReturnType<typeof streamAnalysisSource>>, TError = ErrorType<ErrorEnvelope>>(id: number, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof streamAnalysisSource>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getSetManualVerdictUrl: (id: number) => string;
/**
 * @summary Set a manual verdict for a disputed analysis
 */
export declare const setManualVerdict: (id: number, manualVerdictInput: ManualVerdictInput, options?: Parameters<typeof customFetch>[1]) => Promise<Analysis>;
export declare const getSetManualVerdictMutationOptions: <TError = ErrorType<ErrorEnvelope>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof setManualVerdict>>, TError, {
        id: number;
        data: BodyType<ManualVerdictInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof setManualVerdict>>, TError, {
    id: number;
    data: BodyType<ManualVerdictInput>;
}, TContext>;
export type SetManualVerdictMutationResult = NonNullable<Awaited<ReturnType<typeof setManualVerdict>>>;
export type SetManualVerdictMutationBody = BodyType<ManualVerdictInput>;
export type SetManualVerdictMutationError = ErrorType<ErrorEnvelope>;
/**
* @summary Set a manual verdict for a disputed analysis
*/
export declare const useSetManualVerdict: <TError = ErrorType<ErrorEnvelope>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof setManualVerdict>>, TError, {
        id: number;
        data: BodyType<ManualVerdictInput>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof setManualVerdict>>, TError, {
    id: number;
    data: BodyType<ManualVerdictInput>;
}, TContext>;
export declare const getExportEditedVideoUrl: () => string;
/**
 * @summary Render an edited working copy as MP4
 */
export declare const exportEditedVideo: (videoEditProject: VideoEditProject, options?: Parameters<typeof customFetch>[1]) => Promise<Blob>;
export declare const getExportEditedVideoMutationOptions: <TError = ErrorType<ErrorEnvelope>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof exportEditedVideo>>, TError, {
        data: BodyType<VideoEditProject>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof exportEditedVideo>>, TError, {
    data: BodyType<VideoEditProject>;
}, TContext>;
export type ExportEditedVideoMutationResult = NonNullable<Awaited<ReturnType<typeof exportEditedVideo>>>;
export type ExportEditedVideoMutationBody = BodyType<VideoEditProject>;
export type ExportEditedVideoMutationError = ErrorType<ErrorEnvelope>;
/**
* @summary Render an edited working copy as MP4
*/
export declare const useExportEditedVideo: <TError = ErrorType<ErrorEnvelope>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof exportEditedVideo>>, TError, {
        data: BodyType<VideoEditProject>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof exportEditedVideo>>, TError, {
    data: BodyType<VideoEditProject>;
}, TContext>;
export declare const getRequestUploadUrlUrl: () => string;
/**
 * @summary Request a presigned URL for video upload
 */
export declare const requestUploadUrl: (uploadUrlRequest: UploadUrlRequest, options?: Parameters<typeof customFetch>[1]) => Promise<UploadUrlResponse>;
export declare const getRequestUploadUrlMutationOptions: <TError = ErrorType<ErrorEnvelope>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError, {
        data: BodyType<UploadUrlRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError, {
    data: BodyType<UploadUrlRequest>;
}, TContext>;
export type RequestUploadUrlMutationResult = NonNullable<Awaited<ReturnType<typeof requestUploadUrl>>>;
export type RequestUploadUrlMutationBody = BodyType<UploadUrlRequest>;
export type RequestUploadUrlMutationError = ErrorType<ErrorEnvelope>;
/**
* @summary Request a presigned URL for video upload
*/
export declare const useRequestUploadUrl: <TError = ErrorType<ErrorEnvelope>, TContext = unknown>(options?: {
    mutation?: UseMutationOptions<Awaited<ReturnType<typeof requestUploadUrl>>, TError, {
        data: BodyType<UploadUrlRequest>;
    }, TContext>;
    request?: SecondParameter<typeof customFetch>;
}) => UseMutationResult<Awaited<ReturnType<typeof requestUploadUrl>>, TError, {
    data: BodyType<UploadUrlRequest>;
}, TContext>;
export declare const getGetPublicObjectUrl: (filePath: string) => string;
/**
 * @summary Serve a public object
 */
export declare const getPublicObject: (filePath: string, options?: Parameters<typeof customFetch>[1]) => Promise<Blob>;
export declare const getGetPublicObjectQueryKey: (filePath: string) => readonly [`/api/storage/public-objects/${string}`];
export declare const getGetPublicObjectQueryOptions: <TData = Awaited<ReturnType<typeof getPublicObject>>, TError = ErrorType<ErrorEnvelope>>(filePath: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPublicObject>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getPublicObject>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetPublicObjectQueryResult = NonNullable<Awaited<ReturnType<typeof getPublicObject>>>;
export type GetPublicObjectQueryError = ErrorType<ErrorEnvelope>;
/**
 * @summary Serve a public object
 */
export declare function useGetPublicObject<TData = Awaited<ReturnType<typeof getPublicObject>>, TError = ErrorType<ErrorEnvelope>>(filePath: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getPublicObject>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export declare const getGetStorageObjectUrl: (objectPath: string) => string;
/**
 * @summary Serve an uploaded object
 */
export declare const getStorageObject: (objectPath: string, options?: Parameters<typeof customFetch>[1]) => Promise<Blob>;
export declare const getGetStorageObjectQueryKey: (objectPath: string) => readonly [`/api/storage/objects/${string}`];
export declare const getGetStorageObjectQueryOptions: <TData = Awaited<ReturnType<typeof getStorageObject>>, TError = ErrorType<ErrorEnvelope>>(objectPath: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getStorageObject>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}) => UseQueryOptions<Awaited<ReturnType<typeof getStorageObject>>, TError, TData> & {
    queryKey: QueryKey;
};
export type GetStorageObjectQueryResult = NonNullable<Awaited<ReturnType<typeof getStorageObject>>>;
export type GetStorageObjectQueryError = ErrorType<ErrorEnvelope>;
/**
 * @summary Serve an uploaded object
 */
export declare function useGetStorageObject<TData = Awaited<ReturnType<typeof getStorageObject>>, TError = ErrorType<ErrorEnvelope>>(objectPath: string, options?: {
    query?: UseQueryOptions<Awaited<ReturnType<typeof getStorageObject>>, TError, TData>;
    request?: SecondParameter<typeof customFetch>;
}): UseQueryResult<TData, TError> & {
    queryKey: QueryKey;
};
export {};
//# sourceMappingURL=api.d.ts.map