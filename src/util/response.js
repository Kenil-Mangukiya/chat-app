import { NextResponse } from 'next/server';

export function response(statusCode, data = {}, message = "",success)
{
  return NextResponse.json(
    {
         success,
         message,   
         data : data || {}
    },
    { 
        status: statusCode 
    }
  );
}
