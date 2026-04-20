// Google AdSense ads.txt — yayıncı doğrulaması.
// /ads.txt Google tarafından taranır.
export const dynamic = 'force-static';
export const revalidate = 86_400;

export function GET(): Response {
  return new Response('google.com, pub-9557533039186947, DIRECT, f08c47fec0942fa0\n', {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
