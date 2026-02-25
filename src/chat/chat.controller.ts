import { Controller, OnModuleInit, Post, Body, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { ChatService } from './chat.service';
import { IngestBodyDto } from './dto/ingest.dto';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { FilesInterceptor } from '@nestjs/platform-express';

@Controller('chat')
export class ChatController implements OnModuleInit {
  constructor(private readonly chatService: ChatService) { }

  async onModuleInit() {
    await this.chatService.init();
    console.log('Chat service initialized');
  }

  @Post('ingest')
  ingest(@Body() body: IngestBodyDto) {
    return this.chatService.ingest(body || {});
  }


  @Post('upload')
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, callback) => {
          const uniqueSuffix =
            Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          callback(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
      fileFilter: (req, file, callback) => {
        if (file.mimetype === 'application/pdf') {
          callback(null, true);
        } else {
          callback(new Error('Only pdf files are allowed'), false);
        }
      },
    }),
  )
  async uploadAndIngest(@UploadedFiles() files: Express.Multer.File[]) {
    return this.chatService.handleFileUpload(files);
  }

  @Post('ask')
  async ask(@Body() body: { question: string }) {
    return this.chatService.query(body?.question || '');
  }

}
