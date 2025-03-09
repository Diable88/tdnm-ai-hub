const express = require('express');
const mongoose = require('mongoose');
const app = express();
const port = 3000;

app.use(express.json());

// Kết nối MongoDB
mongoose.connect('mongodb://localhost:27017/marketingDB', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Schema cho dữ liệu phân tích
const AnalysisSchema = new mongoose.Schema({
  adSpend: Number,
  revenue: Number,
  conversions: Number,
  date: { type: Date, default: Date.now }
});
const Analysis = mongoose.model('Analysis', AnalysisSchema);

// API phân tích
app.post('/analyze', async (req, res) => {
  try {
    const { adSpend, revenue, conversions } = req.body;
    if (!adSpend || !revenue) throw new Error('Thiếu dữ liệu adSpend hoặc revenue');

    const roi = ((revenue - adSpend) / adSpend) * 100;
    const cpa = conversions ? adSpend / conversions : null;
    
    const suggestion = roi > 50 
      ? 'Chiến dịch hiệu quả. Đề xuất tăng ngân sách hoặc thử nghiệm kênh mới.'
      : 'ROI thấp. Hãy tối ưu hóa nội dung quảng cáo hoặc nhắm mục tiêu lại đối tượng.';

    const analysis = new Analysis({ adSpend, revenue, conversions });
    await analysis.save();

    res.status(200).json({
      roi: `${roi.toFixed(2)}%`,
      cpa: cpa ? `${cpa.toFixed(2)} VND` : 'Không có dữ liệu chuyển đổi',
      suggestion,
      history: await Analysis.find().sort({ date: -1 }).limit(5) // Lịch sử 5 lần gần nhất
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.listen(port, () => console.log(`MarketingAnalyzer running on port ${port}`));
