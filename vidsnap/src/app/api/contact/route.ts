import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/db/mongodb";

export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const { name, email, message } = body;

    // Validate input
    if (!name || !email || !message) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required fields: name, email, and message are required",
        },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate message length
    if (message.trim().length < 10) {
      return NextResponse.json(
        {
          success: false,
          error: "Message must be at least 10 characters long",
        },
        { status: 400 }
      );
    }

    // Connect to database
    const { contacts } = await connectToDatabase();

    // Create contact document
    const now = new Date();
    const result = await contacts.insertOne({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      message: message.trim(),
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Contact form submitted successfully",
        id: result.insertedId,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    console.error("Contact form error:", error);

    const errorMessage =
      error instanceof Error ? error.message : "An unknown error occurred";

    return NextResponse.json(
      {
        success: false,
        error: `Failed to submit contact form: ${errorMessage}`,
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { success: false, error: "Method not allowed" },
    { status: 405 }
  );
}
