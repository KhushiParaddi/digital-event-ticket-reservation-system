import { NextResponse } from 'next/server';
import { eventContent, embedText, cosineSimilarity } from '@/lib/mongo';
import { apiError } from '@/lib/http';
export const runtime='nodejs';
export async function GET(request:Request){
  const query=new URL(request.url).searchParams.get('q')?.trim()??'';
  if(query.length<2||query.length>240)return NextResponse.json({error:'Search text must be 2 to 240 characters.'},{status:400});
  try{
    const vector=embedText(query);const docs=await (await eventContent()).find({published:true}).toArray();
    const recommendations=docs.map(doc=>({eventId:doc.eventId,title:doc.title,description:doc.description,tags:doc.tags,score:Number(cosineSimilarity(vector,doc.vector).toFixed(4))}))
      .sort((a,b)=>b.score-a.score).slice(0,5);
    return NextResponse.json({recommendations});
  }catch(error){return apiError(error)}
}
