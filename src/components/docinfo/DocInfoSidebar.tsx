import React, { useState } from 'react';
import { DocInfo } from '@/core/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Paperclip, UserPlus, Tag, Send, File } from 'lucide-react';
import { getFrappeApp } from '@/lib/frappe';
import { useAuth } from '@/contexts/AuthContext';

interface DocInfoSidebarProps {
  doctype: string;
  name: string;
  docinfo?: DocInfo | null;
  onRefresh?: () => void;
}

export const DocInfoSidebar: React.FC<DocInfoSidebarProps> = ({
  doctype,
  name,
  docinfo,
  onRefresh,
}) => {
  const { user } = useAuth();
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [newTag, setNewTag] = useState('');

  const tagsList = (docinfo?.tags || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      const frappe = getFrappeApp();
      const userEmail = user?.email || 'Administrator';
      const userName = user?.full_name || userEmail;
      await frappe.call('frappe.desk.form.utils.add_comment', {
        reference_doctype: doctype,
        reference_name: name,
        content: newComment,
        comment_email: userEmail,
        comment_by: userName,
      });
      setNewComment('');
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;

    try {
      const frappe = getFrappeApp();
      await frappe.call('frappe.desk.doctype.tag.tag.add_tag', {
        dt: doctype,
        dn: name,
        tag: newTag.trim(),
      });
      setNewTag('');
      if (onRefresh) onRefresh();
    } catch (err) {
      console.error('Failed to add tag:', err);
    }
  };

  return (
    <Card className="w-full h-full border-l border-border rounded-none shadow-none">
      <CardHeader className="p-4 border-b">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <span>Activity & Details</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Tabs defaultValue="comments" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent p-0">
            <TabsTrigger value="comments" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2 px-3 text-xs">
              <MessageSquare className="h-3.5 w-3.5 mr-1" />
              Comments ({docinfo?.comments?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="attachments" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2 px-3 text-xs">
              <Paperclip className="h-3.5 w-3.5 mr-1" />
              Files ({docinfo?.attachments?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="details" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary py-2 px-3 text-xs">
              <Tag className="h-3.5 w-3.5 mr-1" />
              Tags & Assignments
            </TabsTrigger>
          </TabsList>

          <TabsContent value="comments" className="p-4 space-y-4 m-0">
            <form onSubmit={handleAddComment} className="space-y-2">
              <Textarea
                placeholder="Add a comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="min-h-[70px] text-xs"
              />
              <Button type="submit" size="sm" disabled={isSubmitting || !newComment.trim()} className="w-full">
                <Send className="h-3.5 w-3.5 mr-1" />
                Comment
              </Button>
            </form>

            <div className="space-y-3 mt-4">
              {(docinfo?.comments || []).map((comment: Record<string, unknown>, idx: number) => (
                <div key={String(comment.name || idx)} className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
                  <div className="flex justify-between font-semibold text-foreground">
                    <span>{String(comment.comment_email || 'User')}</span>
                    <span className="text-[10px] text-muted-foreground">{comment.creation ? new Date(String(comment.creation)).toLocaleDateString() : ''}</span>
                  </div>
                  <p className="text-muted-foreground whitespace-pre-wrap">{String(comment.content || '')}</p>
                </div>
              ))}
              {!docinfo?.comments?.length && (
                <p className="text-xs text-muted-foreground text-center py-4">No comments yet</p>
              )}
            </div>
          </TabsContent>

          <TabsContent value="attachments" className="p-4 space-y-3 m-0">
            {(docinfo?.attachments || []).map((file: Record<string, unknown>, idx: number) => (
              <a
                key={String(file.name || idx)}
                href={String(file.file_url || '#')}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between p-2.5 bg-muted/30 hover:bg-muted/60 rounded-lg text-xs border border-border"
              >
                <div className="flex items-center gap-2 truncate">
                  <File className="h-4 w-4 text-primary shrink-0" />
                  <span className="truncate">{String(file.file_name || 'Attachment')}</span>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{file.file_size ? `${Math.round(Number(file.file_size) / 1024)}KB` : ''}</span>
              </a>
            ))}
            {!docinfo?.attachments?.length && (
              <p className="text-xs text-muted-foreground text-center py-4">No attachments uploaded</p>
            )}
          </TabsContent>

          <TabsContent value="details" className="p-4 space-y-6 m-0">
            {/* Tags section */}
            <div className="space-y-2">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-muted-foreground" /> Tags
              </label>
              <div className="flex flex-wrap gap-1">
                {tagsList.map((tag) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {!tagsList.length && <span className="text-xs text-muted-foreground">No tags</span>}
              </div>
              <form onSubmit={handleAddTag} className="flex gap-2 pt-1">
                <Input
                  placeholder="Add tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="h-8 text-xs"
                />
                <Button type="submit" size="sm" variant="outline" className="h-8">
                  Add
                </Button>
              </form>
            </div>

            {/* Assignments section */}
            <div className="space-y-2">
              <label className="text-xs font-semibold flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5 text-muted-foreground" /> Assigned To
              </label>
              <div className="space-y-1">
                {(docinfo?.assignments || []).map((user: string, idx: number) => (
                  <div key={idx} className="text-xs p-2 bg-muted/30 rounded-md">
                    {user}
                  </div>
                ))}
                {!docinfo?.assignments?.length && (
                  <p className="text-xs text-muted-foreground">No users assigned</p>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
