'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import type { CourseSummary, Paginated } from '@lms/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';
import { NativeSelect } from '@/components/ui/native-select';
import { type UploadedVideo, VideoUpload } from '@/modules/courses/video-upload';

/**
 * Publishing a class recording. It becomes a lesson in a course, which is where a learner who
 * missed the class goes looking for it: an uploaded video plays in the lesson (private storage,
 * short-lived links), and a link from the meeting tool is listed as the lesson's resource.
 */
export function RecordingDialog({ sessionId, subject }: { sessionId: string; subject: string }) {
  const [open, setOpen] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [url, setUrl] = useState('');
  const [uploaded, setUploaded] = useState<UploadedVideo | null>(null);
  const [moduleTitle, setModuleTitle] = useState('Recordings');
  const queryClient = useQueryClient();

  const courses = useQuery({
    queryKey: ['courses', 'options'],
    queryFn: () => api<Paginated<CourseSummary>>('/courses?pageSize=100'),
    enabled: open,
  });

  const attach = useMutation({
    mutationFn: () =>
      api<{ lessonId: string }>(`/sessions/${sessionId}/recording`, {
        method: 'POST',
        body: uploaded
          ? {
              fileId: uploaded.fileId,
              courseId,
              moduleTitle,
              ...(uploaded.durationSeconds > 0
                ? { durationSeconds: uploaded.durationSeconds }
                : {}),
            }
          : { url, courseId, moduleTitle },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['schedule'] });
      await queryClient.invalidateQueries({ queryKey: ['sessions'] });
      setOpen(false);
      setUrl('');
      setUploaded(null);
      toast.success('The recording is published to the course');
    },
    onError: (error) =>
      toast.error(isApiError(error) ? error.message : 'The recording could not be published'),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Add recording
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Publish the recording of {subject}</DialogTitle>
          <DialogDescription>
            It becomes an optional lesson, so catching up never counts against anyone.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recording-course">Course</Label>
            <NativeSelect
              id="recording-course"
              className="w-full"
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
            >
              <option value="">Choose a course</option>
              {(courses.data?.data ?? []).map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="space-y-2">
            <Label htmlFor="recording-module">Module</Label>
            <Input
              id="recording-module"
              value={moduleTitle}
              onChange={(e) => setModuleTitle(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recording-file">The recording</Label>
            {uploaded ? (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span>
                  {uploaded.name}
                  {uploaded.durationSeconds > 0
                    ? ` (${Math.max(1, Math.round(uploaded.durationSeconds / 60))} min)`
                    : ''}{' '}
                  is uploaded.
                </span>
                <Button variant="ghost" size="sm" onClick={() => setUploaded(null)}>
                  Use another
                </Button>
              </div>
            ) : (
              <VideoUpload
                id="recording-file"
                context="session-recording"
                label="Upload the video"
                onUploaded={setUploaded}
              />
            )}
          </div>
          {uploaded ? null : (
            <div className="space-y-2">
              <Label htmlFor="recording-url">Or a link to it</Label>
              <Input
                id="recording-url"
                value={url}
                placeholder="https://…"
                onChange={(e) => setUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                The link your meeting tool produced, if the video stays there.
              </p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            disabled={attach.isPending || !courseId || (!uploaded && !url)}
            onClick={() => attach.mutate()}
          >
            {attach.isPending ? 'Publishing…' : 'Publish recording'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
