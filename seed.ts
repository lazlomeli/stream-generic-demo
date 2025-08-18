import { StreamChat } from "stream-chat";
import { requireAuth } from "./api/_utils/auth0"
import { json, bad, serverError } from "./api/_utils/responses";

const apiKey = process.env.STREAM_API_KEY!;
const apiSecret = process.env.STREAM_API_SECRET!;

const SAMPLE_USERS = [
  { id: "alice_smith", name: "Alice Smith", image: "https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face" },
  { id: "bob_johnson", name: "Bob Johnson", image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face" },
  { id: "carol_williams", name: "Carol Williams", image: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face" },
  { id: "david_brown", name: "David Brown", image: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face" },
  { id: "emma_davis", name: "Emma Davis", image: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face" },
];

export default async function handler(req: Request) {
  try {
    if (req.method !== "POST") return bad("Use POST");

    const { sub } = await requireAuth(req);
    const me = sub.replace(/[^a-zA-Z0-9@_-]/g, "_").slice(0, 64);

    const server = StreamChat.getInstance(apiKey, apiSecret);

    await server.upsertUser({ id: me });
    await server.upsertUsers(SAMPLE_USERS);

    // @ts-ignore-next-line
    const general = server.channel("messaging", "general", { name: "General", members: [me] });
    await general.create();

    for (const u of SAMPLE_USERS) {
      // @ts-ignore-next-line
      const dm = server.channel("messaging", { 
        members: [me, u.id],
        image: u.image,
        name: u.name
      });
      await dm.create();
    }

    return json({ ok: true });
  } catch (e: any) {
    return serverError(e?.message || "seed failed");
  }
}
