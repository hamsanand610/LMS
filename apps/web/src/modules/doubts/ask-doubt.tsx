'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Send } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { toast } from 'sonner';
import type { CourseDetail, CourseProgress, DoubtThread } from '@lms/shared';
import { FieldError } from '@/components/field-error';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { isApiError } from '@/lib/api/errors';
import { api } from '@/lib/api/http';

/**
 * Asking a doubt. It can be about one of the learner's courses, and within it one lesson, or about
 * nothing in particular. A lesson page links here with both already chosen.
 */
export function AskDoubt({
  courseId: initialCourse,
  lessonId: initialLesson,
}: {
  courseId?: string;
  lessonId?: string;
}) {
  const router = useRouter();
  const [courseId, setCourseId] = useState(initialCourse ?? '');
  const [lessonId, setLessonId] = useState(initialLesson ?? '');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const courses = useQuery({
    queryKey: ['my-courses'],
    queryFn: () => api<CourseProgress[]>('/me/courses'),
  });
  const course = useQuery({
    queryKey: ['course', courseId],
    queryFn: () => api<CourseDetail>(`/courses/${courseId}`),
    enabled: Boolean(courseId),
  });
  const lessons = course.data?.modules.flatMap((m) =>
    m.lessons.map((l) => ({ id: l.id, title: l.title, module: m.title })),
  );

  const ask = useMutation({
    mutationFn: () =>
      api<DoubtThread>('/me/doubts', {
        method: 'POST',
        body: { title, body, courseId: courseId || null, lessonId: lessonId || null },
      }),
    onSuccess: (thread) => {
      toast.success('Sent to your trainers');
      router.push(`/doubts/${thread.id}`);
    },
    onError: (error: Error) => {
      if (isApiError(error)) {
        setErrors(error.fieldErrors);
        toast.error(error.message);
      } else {
        toast.error('The doubt could not be sent');
      }
    },
  });

  return (
    <Card className="max-w-3xl">
      <CardContent className="px-5 pt-6 sm:px-6">
        <form
          className="space-y-5"
          onSubmit={(event) => {
            event.preventDefault();
            setErrors({});
            ask.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="doubt-course">Course</Label>
              <NativeSelect
                id="doubt-course"
                className="w-full"
                value={courseId}
                onChange={(event) => {
                  setCourseId(event.target.value);
                  setLessonId('');
                }}
              >
                <option value="">Not about a course</option>
                {(courses.data ?? []).map((c) => (
                  <option key={c.courseId} value={c.courseId}>
                    {c.title}
                  </option>
                ))}
              </NativeSelect>
              <FieldError message={errors['courseId']} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="doubt-lesson">Lesson</Label>
              <NativeSelect
                id="doubt-lesson"
                className="w-full"
                value={lessonId}
                disabled={!courseId || !lessons}
                onChange={(event) => setLessonId(event.target.value)}
              >
                <option value="">
                  {courseId ? 'The course in general' : 'Choose a course first'}
                </option>
                {(lessons ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.module} · {l.title}
                  </option>
                ))}
              </NativeSelect>
              <FieldError message={errors['lessonId']} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doubt-title">Your question in one line</Label>
            <Input
              id="doubt-title"
              required
              minLength={4}
              maxLength={160}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Why does my HashMap lose an entry when I change the key?"
            />
            <FieldError message={errors['title']} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="doubt-body">The details</Label>
            <Textarea
              id="doubt-body"
              required
              minLength={4}
              maxLength={4000}
              rows={7}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="What you tried, what you expected, and what happened instead. Paste the code if it helps."
            />
            <p className="text-xs text-muted-foreground">
              The trainers of your batch see this, and so do administrators. Other learners do not.
            </p>
            <FieldError message={errors['body']} />
          </div>

          <div className="flex gap-2 border-t border-border pt-5">
            <Button type="submit" disabled={ask.isPending}>
              <Send aria-hidden="true" />
              {ask.isPending ? 'Sending…' : 'Send to my trainers'}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/doubts">Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
