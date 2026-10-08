import { NextRequest, NextResponse } from 'next/server';
import { SpotsRepository } from '@/lib/db/repository';
import { FeedbackStatus } from '@/types/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const statusParam = url.searchParams.get('status');

    const allFeedbacks = await SpotsRepository.getFeedbackList();
    const counts = {
      all: allFeedbacks.length,
      new: allFeedbacks.filter((f) => f.status === 'new').length,
      seen: allFeedbacks.filter((f) => f.status === 'seen').length,
      done: allFeedbacks.filter((f) => f.status === 'done').length,
    };

    let feedback = allFeedbacks;
    if (statusParam && ['new', 'seen', 'done'].includes(statusParam)) {
      feedback = allFeedbacks.filter((f) => f.status === statusParam);
    }

    return NextResponse.json(
      { success: true, feedback, counts },
      { headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate' } }
    );
  } catch (error) {
    console.error('Error fetching feedback:', error);
    return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status } = body;

    if (!id || !['new', 'seen', 'done'].includes(status)) {
      return NextResponse.json({ error: 'Invalid id or status' }, { status: 400 });
    }

    const updated = await SpotsRepository.updateFeedbackStatus(id, status as FeedbackStatus);
    if (!updated) {
      return NextResponse.json({ error: 'Feedback not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, feedback: updated });
  } catch (error) {
    console.error('Error updating feedback status:', error);
    return NextResponse.json({ error: 'Failed to update feedback' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing feedback id' }, { status: 400 });
    }

    const deleted = await SpotsRepository.deleteFeedback(id);
    return NextResponse.json({ success: deleted });
  } catch (error) {
    console.error('Error deleting feedback:', error);
    return NextResponse.json({ error: 'Failed to delete feedback' }, { status: 500 });
  }
}
