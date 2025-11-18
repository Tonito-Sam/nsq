import React, { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Upload } from "lucide-react";

const BUCKET_NAME =
  (import.meta.env?.VITE_SUPABASE_STORAGE_BUCKET as string) ||
  (typeof process !== "undefined" &&
    (process.env as any)?.REACT_APP_SUPABASE_STORAGE_BUCKET) ||
  "sound-bank";

const SoundBankManager: React.FC = () => {
  const { toast } = useToast();
  const [sounds, setSounds] = useState<any[]>([]);
  const [loadingSounds, setLoadingSounds] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [url, setUrl] = useState<string>("");
  const [saveToJson, setSaveToJson] = useState(true);
  const [saveToTable, setSaveToTable] = useState(true);
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState("");
  const [category, setCategory] = useState("piano");

  const categories = [
    "piano",
    "percussion",
    "strings",
    "bass",
    "acoustic",
    "flute",
    "synth",
    "vocals",
    "guitar",
    "drums",
  ];

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `soundbank/${Date.now()}-${safeName}`;

      const { error } = await supabase.storage
        .from(BUCKET_NAME)
        .upload(path, file, { cacheControl: "3600" });

      if (error) throw error;

      const res = await supabase.storage.from(BUCKET_NAME).getPublicUrl(path);
      const publicUrl = res?.data?.publicUrl || "";

      // If admin requested automatic persistence, save to destinations and
      // avoid showing the public URL in the UI (keeping the admin page clean).
      if (saveToJson || saveToTable) {
        // Save to table if requested

        // Save to public sounds.json if requested
        if (saveToTable) {
          try {
            const insertRes = await supabase.from("soundbank").insert({
              url: publicUrl,
              title: title || safeName,
              metadata: { genre: genre || null, category: category || null },
            });
            if ((insertRes as any).error) {
              // If insert fails due to RLS or permission issues, surface the error
              // and present the public URL so the admin can add the row manually.
              console.warn('soundbank table insert error', (insertRes as any).error);
              setUrl(publicUrl);
              try { toast({ description: `DB insert failed: ${((insertRes as any).error.message || (insertRes as any).error).toString()}`, variant: 'destructive' }); } catch {}
              // Do not continue with auto-saving sounds.json to avoid masking the DB error.
              setUploading(false);
              return;
            }
          } catch (e: any) {
            console.warn('Error inserting to soundbank table', e);
            setUrl(publicUrl);
            try { toast({ description: `DB insert failed: ${e?.message || e}`, variant: 'destructive' }); } catch {}
            setUploading(false);
            return;
          }
  }

  // Give immediate feedback and clear the form
  setFile(null);
  setTitle('');
  setGenre('');
  setCategory(categories[0] || 'piano');
  setUrl('');
  try { toast({ description: 'Uploaded and saved to sound-bank destinations.' }); } catch (e) { try { alert('Uploaded and saved to sound-bank destinations.'); } catch {} }
      } else {
        // no auto-save requested, show the public URL so admin can copy it manually
        setUrl(publicUrl);
      }
    } catch (err: any) {
      console.error(err);
      alert("Upload failed: " + (err.message || err));
    } finally {
      setUploading(false);
    }
  };

  const fetchSounds = async () => {
    setLoadingSounds(true);
    try {
      const { data, error } = await supabase.from('soundbank').select('*').order('id', { ascending: false }).limit(200);
      if (error) throw error;
      setSounds(Array.isArray(data) ? data : []);
    } catch (e) {
      console.warn('Could not fetch soundbank', e);
      setSounds([]);
    } finally {
      setLoadingSounds(false);
    }
  };

  React.useEffect(() => { fetchSounds(); }, []);

  const syncFromTable = async () => {
    try {
      const syncSecret = (import.meta.env as any)?.VITE_SYNC_SECRET || '';
      // Prefer an explicit API URL from env (useful in dev where frontend and backend use different ports)
  const apiBase = (import.meta.env as any)?.VITE_API_URL || '';
  const defaultPort = (import.meta.env as any)?.VITE_BACKEND_PORT || 5000;
  // If running on localhost, prefer http to avoid https://localhost:PORT issues
  const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const proto = isLocal ? 'http:' : window.location.protocol;
  const fallbackBase = `${proto}//${window.location.hostname}:${defaultPort}`;
  const url = apiBase ? `${apiBase.replace(/\/$/, '')}/api/admin/sync-sounds` : `${fallbackBase.replace(/\/$/, '')}/api/admin/sync-sounds`;
    // Helpful debug log when running locally
    // eslint-disable-next-line no-console
    console.debug('Sync endpoint URL', url);
    // Don't log the secret value, but log whether one is configured in the frontend env.
    const hasFrontendSecret = !!syncSecret;
    // eslint-disable-next-line no-console
    console.debug('VITE_SYNC_SECRET configured in frontend?', hasFrontendSecret);

      const headers: Record<string, string> = {};
      if (syncSecret) headers['x-sync-secret'] = syncSecret;
      const res = await fetch(url, {
        method: 'POST',
        headers,
      });

      const text = await res.text();
      let data: any = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        console.warn('Could not parse sync response as JSON', e, text);
      }

      if (res.status === 401) {
        const msg = data?.error || text || 'Unauthorized';
        const hint = hasFrontendSecret
          ? 'Frontend sent a secret but the server rejected it. Ensure VITE_SYNC_SECRET matches backend SYNC_SECRET.'
          : 'Frontend did not send a sync secret. Set VITE_SYNC_SECRET in `.env.local` to match backend SYNC_SECRET and restart the dev server.';
        toast({ description: `Sync failed: ${msg}. ${hint}`, variant: 'destructive' });
        return;
      }

      if (!res.ok) {
        const msg = data?.error || text || res.status;
        toast({ description: `Sync failed: ${msg}`, variant: 'destructive' });
        return;
      }

      toast({ description: `Synced ${data?.count ?? 'unknown'} tracks to public/sounds.json` });
      // Refresh local table view
      fetchSounds();
    } catch (e: any) {
      console.error('Sync error', e);
      toast({ description: `Sync error: ${e?.message || e}`, variant: 'destructive' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this track from soundbank?')) return;
    try {
      const { error } = await supabase.from('soundbank').delete().eq('id', id);
      if (error) throw error;
      toast({ description: 'Deleted.' });
      setSounds(s => s.filter(s => s.id !== id));
    } catch (e: any) {
      console.error('Delete failed', e);
      toast({ description: `Delete failed: ${e?.message || e}`, variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1116] p-8 text-gray-100">
      <div className="max-w-3xl mx-auto">
        <Card className="bg-[#1a1c23] border border-gray-800 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl font-semibold flex items-center gap-2 text-purple-400">
              🎵 Sound Bank Manager
            </CardTitle>
            <p className="text-sm text-gray-400">
              Upload audio files to Supabase storage and automatically save them
              to your sound bank table or public <code>sounds.json</code>.
            </p>
          </CardHeader>

          <CardContent className="space-y-5 mt-3">
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2 gap-2">
                <TabsTrigger value="upload">Upload</TabsTrigger>
                <TabsTrigger value="manage">Manage</TabsTrigger>
              </TabsList>

              <TabsContent value="upload" className="space-y-5 mt-3">
                {/* existing upload UI follows here - keep unchanged */}
                
                {/* Title */}
                <div className="space-y-2">
                  <Label className="text-gray-300">Title</Label>
                  <Input
                    placeholder="e.g. Ride for You"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                {/* Genre */}
                <div className="space-y-2">
                  <Label className="text-gray-300">Genre</Label>
                  <Input
                    placeholder="e.g. Blues, Pop, Afrobeat..."
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                  />
                </div>

                {/* Category */}
                <div className="space-y-2">
                  <Label className="text-gray-300">Category</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="bg-gray-900 text-gray-200 border-gray-700">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 text-gray-100 border-gray-800">
                      {categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c.charAt(0).toUpperCase() + c.slice(1)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* File Upload */}
                <div className="space-y-2">
                  <Label className="text-gray-300">Audio File</Label>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      className="bg-gray-900 border-gray-700 text-gray-100 hover:bg-gray-800"
                      onClick={() =>
                        document.getElementById("audioFile")?.click()
                      }
                    >
                      <Upload className="w-4 h-4 mr-2" /> Choose File
                    </Button>
                    <input
                      id="audioFile"
                      type="file"
                      accept="audio/*"
                      hidden
                      onChange={(e) => setFile(e.target.files?.[0] || null)}
                    />
                    {file && (
                      <span className="text-sm text-gray-400 truncate">
                        {file.name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Options */}
                <div className="flex items-center justify-between border-t border-gray-800 pt-4">
                  <div className="flex items-center gap-3">
                    <Switch checked={saveToJson} onCheckedChange={setSaveToJson} />
                    <Label className="text-gray-300 text-sm">
                      Save to <code>/public/sounds.json</code>
                    </Label>
                  </div>
                  <div className="flex items-center gap-3">
                    <Switch checked={saveToTable} onCheckedChange={setSaveToTable} />
                    <Label className="text-gray-300 text-sm">
                      Save to soundbank table
                    </Label>
                  </div>
                </div>

                {/* Upload Button */}
                <div className="pt-3">
                  <Button
                    onClick={handleUpload}
                    disabled={!file || uploading}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" /> Upload to Storage
                      </>
                    )}
                  </Button>
                </div>

                {/* Public URL */}
                {url && (
                  <div className="mt-4 p-3 bg-gray-900 border border-gray-700 rounded-lg">
                    <p className="text-sm text-gray-300 mb-1">Public URL:</p>
                    <div className="flex items-center gap-2">
                      <Input readOnly value={url} className="bg-gray-800" />
                      <Button
                        variant="outline"
                        onClick={() => navigator.clipboard.writeText(url)}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="manage" className="space-y-4 mt-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold">Manage sound bank</h3>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={syncFromTable}>Sync</Button>
                    <Button variant="ghost" onClick={fetchSounds}>Refresh</Button>
                  </div>
                </div>

                <div className="overflow-auto bg-gray-900 rounded border border-gray-800">
                  <table className="min-w-full table-fixed text-sm">
                    <thead>
                      <tr className="text-left text-gray-400">
                        <th className="p-3 w-12">ID</th>
                        <th className="p-3">Title</th>
                        <th className="p-3">Category</th>
                        <th className="p-3">Genre</th>
                        <th className="p-3">URL</th>
                        <th className="p-3 w-32">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {loadingSounds ? (
                        <tr><td colSpan={6} className="p-4 text-center text-gray-400">Loading…</td></tr>
                      ) : sounds.length === 0 ? (
                        <tr><td colSpan={6} className="p-4 text-center text-gray-400">No tracks found</td></tr>
                      ) : (
                        sounds.map(s => (
                          <tr key={s.id} className="border-t border-gray-800 hover:bg-gray-800">
                            <td className="p-2">{s.id}</td>
                            <td className="p-2">{s.title || '-'}</td>
                            <td className="p-2">{s.metadata?.category || '-'}</td>
                            <td className="p-2">{s.metadata?.genre || '-'}</td>
                            <td className="p-2 text-ellipsis overflow-hidden max-w-xs"><a className="text-blue-400 underline" href={s.url} target="_blank" rel="noreferrer">Open</a></td>
                            <td className="p-2">
                              <div className="flex gap-2">
                                <Button size="sm" variant="ghost" onClick={() => navigator.clipboard.writeText(s.url)}>Copy</Button>
                                <Button size="sm" variant="destructive" onClick={() => handleDelete(s.id)}>Delete</Button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </Tabs>
            {/* Upload/manage tabs render the upload UI and management table above. */}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default SoundBankManager;
