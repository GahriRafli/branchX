import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import bcrypt from 'bcryptjs';

// GET all users (admin only)
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: { id: true, name: true, nip: true, role: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ users });
  } catch (err: any) {
    console.error('GET Users error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// POST create a new user (admin only)
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { name, nip, password, role } = await request.json();

    if (!name || !nip || !password) {
      return NextResponse.json(
        { error: 'Name, NIP, and password are required' },
        { status: 400 }
      );
    }

    if (!/^\d+$/.test(nip)) {
      return NextResponse.json({ error: 'NIP must contain only numbers' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { nip } });
    if (existing) {
      return NextResponse.json(
        { error: 'User with this NIP already exists' },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        nip,
        password: hashedPassword,
        role: role === 'ADMIN' ? 'ADMIN' : 'USER',
      },
      select: { id: true, name: true, nip: true, role: true, createdAt: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (err: any) {
    console.error('POST User error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// PATCH update a user (admin only)
export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id, name, nip, role, password } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    const updateData: Record<string, string> = {};
    if (name) updateData.name = name;
    if (nip) {
      if (!/^\d+$/.test(nip)) {
        return NextResponse.json({ error: 'NIP must contain only numbers' }, { status: 400 });
      }
      updateData.nip = nip;
    }
    if (role) updateData.role = role === 'ADMIN' ? 'ADMIN' : 'USER';
    if (password) updateData.password = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, nip: true, role: true, createdAt: true },
    });

    return NextResponse.json({ user });
  } catch (err: any) {
    console.error('PATCH User error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}

// DELETE a user (admin only)
export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    console.log('Attempting to delete user with ID:', id, 'By admin:', session.userId);

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // Prevent deleting yourself
    if (id === session.userId) {
      return NextResponse.json(
        { error: 'You cannot delete your own account' },
        { status: 400 }
      );
    }

    // Unassign tasks before deleting user
    await prisma.task.updateMany({
      where: { assigneeId: id },
      data: { assigneeId: null },
    });

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ message: 'User deleted' });
  } catch (err: any) {
    console.error('DELETE User error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
