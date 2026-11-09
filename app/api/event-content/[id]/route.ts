import { NextResponse } from 'next/server';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { currentUser } from '@/lib/auth';
import { eventContent, embedText } from '@/lib/mongo';
import { apiError, sameOrigin, validationError } from '@/lib/http';

export const runtime='nodejs';
const schema=z.object({title:z.string().trim().min(3).max(200).optional(),description:z.string().trim().min(10).max(5000).optional(),tags:z.array(z.string().trim().min(1).max(40)).max(20).optional(),published:z.boolean().optional()}).refine(value=>Object.keys(value).length>0);
async function requireAdmin(){const user=await currentUser();if(!user)return NextResponse.json({error:'Sign in required.'},{status:401});if(user.role!=='ADMIN')return NextResponse.json({error:'Organizer access required.'},{status:403});return null}
export async function PATCH(request:Request,context:{params:Promise<{id:string}>}){
  if(!sameOrigin(request))return NextResponse.json({error:'Cross-origin request rejected.'},{status:403});
  const denied=await requireAdmin();if(denied)return denied;
  const id=(await context.params).id;if(!ObjectId.isValid(id))return NextResponse.json({error:'Invalid content id.'},{status:400});
  const parsed=schema.safeParse(await request.json());if(!parsed.success)return validationError('Invalid event content.');
  try{const collection=await eventContent();const current=await collection.findOne({_id:new ObjectId(id)});if(!current)return NextResponse.json({error:'Content not found.'},{status:404});
    const next={...current,...parsed.data};const vector=embedText(`${next.title} ${next.description} ${next.tags.join(' ')}`);
    await collection.updateOne({_id:current._id},{$set:{...parsed.data,vector,updatedAt:new Date()}});return NextResponse.json({ok:true});
  }catch(error){return apiError(error)}
}
export async function DELETE(request:Request,context:{params:Promise<{id:string}>}){
  if(!sameOrigin(request))return NextResponse.json({error:'Cross-origin request rejected.'},{status:403});
  const denied=await requireAdmin();if(denied)return denied;
  const id=(await context.params).id;if(!ObjectId.isValid(id))return NextResponse.json({error:'Invalid content id.'},{status:400});
  try{const result=await (await eventContent()).deleteOne({_id:new ObjectId(id)});if(!result.deletedCount)return NextResponse.json({error:'Content not found.'},{status:404});return NextResponse.json({ok:true})}
  catch(error){return apiError(error)}
}
